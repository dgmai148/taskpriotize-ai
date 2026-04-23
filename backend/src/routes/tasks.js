const express = require('express');
const fetch = require('node-fetch');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5050';

// Auto-score all tasks in a project via ML service (fire-and-forget)
async function autoScoreProject(projectId) {
  try {
    const tasksResult = await pool.query(
      `SELECT t.*,
              (SELECT COUNT(*) FROM task_dependencies td WHERE td.task_id = t.id) as dep_count,
              (SELECT COUNT(*) FROM task_dependencies td WHERE td.depends_on_id = t.id) as blocked_count
       FROM tasks t WHERE t.project_id = $1`,
      [projectId]
    );
    const tasks = tasksResult.rows;
    if (tasks.length === 0) return;

    const mlPayload = tasks.map(t => ({
      id: t.id,
      features: {
        story_points: t.story_points || 0,
        manual_priority: { low: 0.2, medium: 0.5, high: 0.8, critical: 1.0 }[t.manual_priority] || 0.5,
        dependency_count: parseInt(t.dep_count) || 0,
        blocked_tasks_count: parseInt(t.blocked_count) || 0,
        days_until_due: t.due_date
          ? Math.max(0, Math.ceil((new Date(t.due_date) - new Date()) / (1000 * 60 * 60 * 24)))
          : 30,
        status_progress: { open: 0, in_progress: 0.3, review: 0.7, done: 1.0, blocked: 0.1 }[t.status] || 0,
        age_days: Math.ceil((new Date() - new Date(t.created_at)) / (1000 * 60 * 60 * 24)),
      },
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: mlPayload }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!mlResponse.ok) return;
    const predictions = await mlResponse.json();

    for (const pred of predictions.results) {
      await pool.query(
        `UPDATE tasks SET ai_priority_score = $1, ai_explanation = $2, updated_at = NOW() WHERE id = $3`,
        [pred.score, JSON.stringify(pred.explanation), pred.id]
      );
    }
    console.log(`[AI] Auto-scored ${predictions.results.length} tasks in project ${projectId}`);
  } catch (err) {
    // Silent fail — auto-scoring is best-effort
    console.log('[AI] Auto-score skipped:', err.message);
  }
}

// GET /api/tasks — list tasks with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { project_id, assignee_id, status, priority, search, my_tasks } = req.query;
    let query = `
      SELECT t.*,
             u.name as assignee_name, u.avatar_color as assignee_color,
             c.name as creator_name,
             p.name as project_name,
             COALESCE(
               (SELECT json_agg(json_build_object('id', td.depends_on_id, 'title', dt.title))
                FROM task_dependencies td
                JOIN tasks dt ON dt.id = td.depends_on_id
                WHERE td.task_id = t.id), '[]'
             ) as dependencies,
             (SELECT COUNT(*) FROM priority_overrides po WHERE po.task_id = t.id) > 0 as is_overridden,
             (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      params.push(project_id);
      query += ` AND t.project_id = $${params.length}`;
    }
    if (my_tasks === 'true') {
      params.push(req.user.id);
      query += ` AND t.assignee_id = $${params.length}`;
    }
    if (assignee_id) {
      params.push(assignee_id);
      query += ` AND t.assignee_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      query += ` AND t.manual_priority = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`;
    }

    query += ' ORDER BY t.ai_priority_score DESC, t.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Tasks] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/:id — single task detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Reject UUID-like IDs only, let non-UUID params fall through to other routes
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    const result = await pool.query(
      `SELECT t.*,
              u.name as assignee_name, u.avatar_color as assignee_color,
              c.name as creator_name, p.name as project_name
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users c ON t.created_by = c.id
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Tasks] Get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks — create task
router.post('/', authenticate, async (req, res) => {
  try {
    const { project_id, title, description, status, manual_priority, assignee_id, story_points, due_date, dependencies, tags } = req.body;
    if (!project_id || !title) {
      return res.status(400).json({ error: 'project_id and title are required' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (project_id, title, description, status, manual_priority, assignee_id, created_by, story_points, due_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        project_id, title, description || '', status || 'open',
        manual_priority || 'medium', assignee_id || null, req.user.id,
        story_points || 0, due_date || null, tags || [],
      ]
    );
    const task = result.rows[0];

    // Add dependencies
    if (dependencies && dependencies.length > 0) {
      for (const depId of dependencies) {
        await pool.query(
          'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [task.id, depId]
        );
      }
      await pool.query('UPDATE tasks SET dependency_count = $1 WHERE id = $2', [dependencies.length, task.id]);
    }

    // Notify assignee
    if (assignee_id && assignee_id !== req.user.id) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, message, link) VALUES ($1, 'assignment', $2, $3)`,
        [assignee_id, `${req.user.name} assigned you "${title}"`, `/projects/${project_id}`]
      );
    }

    // Activity log
    await pool.query(
      `INSERT INTO task_activity (task_id, user_id, action, new_value) VALUES ($1, $2, 'created', $3)`,
      [task.id, req.user.id, title]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create', 'task', $2, $3)`,
      [req.user.id, task.id, JSON.stringify({ title, project_id })]
    );

    // Auto-score project tasks in background
    autoScoreProject(project_id).catch(() => {});

    res.status(201).json(task);
  } catch (err) {
    console.error('[Tasks] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/:id — update task
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Get old task for activity tracking
    const oldTask = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (oldTask.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const old = oldTask.rows[0];

    const { title, description, status, manual_priority, assignee_id, story_points, due_date, tags } = req.body;

    // Handle completed_at
    let completedAt = old.completed_at;
    if (status === 'done' && old.status !== 'done') completedAt = new Date();
    else if (status && status !== 'done') completedAt = null;

    const result = await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         manual_priority = COALESCE($4, manual_priority),
         assignee_id = COALESCE($5, assignee_id),
         story_points = COALESCE($6, story_points),
         due_date = COALESCE($7, due_date),
         tags = COALESCE($8, tags),
         completed_at = $9,
         updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [title, description, status, manual_priority, assignee_id, story_points, due_date, tags, completedAt, req.params.id]
    );

    // Activity tracking for key changes
    if (status && status !== old.status) {
      await pool.query(
        'INSERT INTO task_activity (task_id, user_id, action, old_value, new_value) VALUES ($1,$2,$3,$4,$5)',
        [req.params.id, req.user.id, 'status_change', old.status, status]
      );
    }
    if (assignee_id && assignee_id !== old.assignee_id) {
      await pool.query(
        'INSERT INTO task_activity (task_id, user_id, action, old_value, new_value) VALUES ($1,$2,$3,$4,$5)',
        [req.params.id, req.user.id, 'reassigned', old.assignee_id, assignee_id]
      );
      // Notify new assignee
      if (assignee_id !== req.user.id) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, message, link) VALUES ($1, 'assignment', $2, $3)`,
          [assignee_id, `${req.user.name} assigned you "${old.title}"`, `/projects/${old.project_id}`]
        );
      }
    }

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update', 'task', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify(req.body)]
    );

    // Auto-score project tasks in background when key fields change
    if (status || manual_priority || due_date || story_points) {
      autoScoreProject(result.rows[0].project_id).catch(() => {});
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Tasks] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id, title', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'delete', 'task', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({ title: result.rows[0].title })]
    );

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('[Tasks] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:id/dependencies
router.post('/:id/dependencies', authenticate, async (req, res) => {
  try {
    const { depends_on_id } = req.body;
    if (!depends_on_id) return res.status(400).json({ error: 'depends_on_id required' });

    await pool.query(
      'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, depends_on_id]
    );
    const countResult = await pool.query('SELECT COUNT(*) as cnt FROM task_dependencies WHERE task_id = $1', [req.params.id]);
    await pool.query('UPDATE tasks SET dependency_count = $1 WHERE id = $2', [countResult.rows[0].cnt, req.params.id]);

    // Auto-score after dependency change
    const taskRow = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [req.params.id]);
    if (taskRow.rows.length > 0) autoScoreProject(taskRow.rows[0].project_id).catch(() => {});

    res.json({ message: 'Dependency added' });
  } catch (err) {
    console.error('[Tasks] Dependency error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/graph/:projectId — dependency graph
router.get('/graph/:projectId', authenticate, async (req, res) => {
  try {
    const tasks = await pool.query(
      'SELECT id, title, status, ai_priority_score FROM tasks WHERE project_id = $1',
      [req.params.projectId]
    );
    const deps = await pool.query(
      `SELECT td.task_id, td.depends_on_id FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id WHERE t.project_id = $1`,
      [req.params.projectId]
    );
    res.json({
      nodes: tasks.rows,
      edges: deps.rows.map(d => ({ from: d.depends_on_id, to: d.task_id })),
    });
  } catch (err) {
    console.error('[Tasks] Graph error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/override-priority
router.post('/override-priority', authenticate, requireRole('pm', 'admin'), async (req, res) => {
  try {
    const { task_id, new_score, reason } = req.body;
    if (!task_id || new_score == null) {
      return res.status(400).json({ error: 'task_id and new_score required' });
    }

    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [task_id]);
    if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const previousScore = taskResult.rows[0].ai_priority_score;

    await pool.query(
      `INSERT INTO priority_overrides (task_id, overridden_by, previous_score, new_score, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [task_id, req.user.id, previousScore, new_score, reason || '']
    );
    await pool.query('UPDATE tasks SET ai_priority_score = $1, updated_at = NOW() WHERE id = $2', [new_score, task_id]);

    await pool.query(
      'INSERT INTO task_activity (task_id, user_id, action, old_value, new_value) VALUES ($1,$2,$3,$4,$5)',
      [task_id, req.user.id, 'priority_override', String(previousScore), String(new_score)]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'priority_override', 'task', $2, $3)`,
      [req.user.id, task_id, JSON.stringify({ previous_score: previousScore, new_score, reason })]
    );

    if (taskResult.rows[0].assignee_id && taskResult.rows[0].assignee_id !== req.user.id) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, message, link) VALUES ($1, 'override', $2, $3)`,
        [taskResult.rows[0].assignee_id, `Priority for "${taskResult.rows[0].title}" overridden to ${new_score}% by ${req.user.name}`, `/projects/${taskResult.rows[0].project_id}`]
      );
    }

    res.json({ message: 'Priority overridden', previous_score: previousScore, new_score });
  } catch (err) {
    console.error('[Tasks] Override error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/bulk/update — bulk status update
router.put('/bulk/update', authenticate, async (req, res) => {
  try {
    const { task_ids, status, assignee_id } = req.body;
    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({ error: 'task_ids array required' });
    }

    let updated = 0;
    for (const id of task_ids) {
      const updates = {};
      if (status) updates.status = status;
      if (assignee_id) updates.assignee_id = assignee_id;

      if (Object.keys(updates).length > 0) {
        const setClauses = [];
        const params = [];
        if (status) {
          params.push(status);
          setClauses.push(`status = $${params.length}`);
          if (status === 'done') {
            setClauses.push('completed_at = NOW()');
          }
        }
        if (assignee_id) {
          params.push(assignee_id);
          setClauses.push(`assignee_id = $${params.length}`);
        }
        setClauses.push('updated_at = NOW()');
        params.push(id);
        await pool.query(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${params.length}`, params);
        updated++;
      }
    }

    res.json({ message: `${updated} tasks updated` });
  } catch (err) {
    console.error('[Tasks] Bulk update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
