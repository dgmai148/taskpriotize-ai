const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/overview — system-wide stats
router.get('/overview', authenticate, async (req, res) => {
  try {
    const [users, projects, tasks, recentActivity] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE role = 'admin') as admins,
        COUNT(*) FILTER (WHERE role = 'pm') as pms,
        COUNT(*) FILTER (WHERE role = 'developer') as developers,
        COUNT(*) FILTER (WHERE is_active = true) as active
      FROM users`),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM projects`),
      pool.query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'review') as review,
        COUNT(*) FILTER (WHERE status = 'done') as done,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE manual_priority = 'critical') as critical,
        COUNT(*) FILTER (WHERE manual_priority = 'high') as high_priority,
        COALESCE(AVG(ai_priority_score) FILTER (WHERE ai_priority_score > 0), 0) as avg_ai_score,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'done') as overdue
      FROM tasks`),
      pool.query(`SELECT COUNT(*) as total FROM audit_log WHERE created_at > NOW() - INTERVAL '7 days'`),
    ]);

    res.json({
      users: users.rows[0],
      projects: projects.rows[0],
      tasks: tasks.rows[0],
      recent_activity_count: recentActivity.rows[0].total,
    });
  } catch (err) {
    console.error('[Analytics] Overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/team-workload — tasks per assignee
router.get('/team-workload', authenticate, async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = `
      SELECT u.id, u.name, u.role, u.avatar_color,
        COUNT(t.id) FILTER (WHERE t.status != 'done') as active_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'done') as completed_tasks,
        COUNT(t.id) as total_tasks,
        COALESCE(SUM(t.story_points) FILTER (WHERE t.status != 'done'), 0) as active_points,
        COALESCE(SUM(t.story_points) FILTER (WHERE t.status = 'done'), 0) as completed_points,
        COUNT(t.id) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status != 'done') as overdue_tasks
      FROM users u
      LEFT JOIN tasks t ON t.assignee_id = u.id
    `;
    const params = [];
    if (project_id) {
      params.push(project_id);
      query += ` AND t.project_id = $${params.length}`;
    }
    query += ` WHERE u.is_active = TRUE GROUP BY u.id, u.name, u.role, u.avatar_color ORDER BY active_tasks DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Analytics] Workload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/project/:id — project-specific analytics
router.get('/project/:id', authenticate, async (req, res) => {
  try {
    const projectId = req.params.id;

    const [statusDist, priorityDist, timeline, topScored] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*) as count FROM tasks WHERE project_id = $1 GROUP BY status`,
        [projectId]
      ),
      pool.query(
        `SELECT manual_priority, COUNT(*) as count FROM tasks WHERE project_id = $1 GROUP BY manual_priority`,
        [projectId]
      ),
      pool.query(
        `SELECT DATE(created_at) as date, COUNT(*) as created,
                COUNT(*) FILTER (WHERE status = 'done') as completed
         FROM tasks WHERE project_id = $1
         GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`,
        [projectId]
      ),
      pool.query(
        `SELECT id, title, ai_priority_score, status, manual_priority
         FROM tasks WHERE project_id = $1 AND ai_priority_score > 0
         ORDER BY ai_priority_score DESC LIMIT 10`,
        [projectId]
      ),
    ]);

    res.json({
      status_distribution: statusDist.rows,
      priority_distribution: priorityDist.rows,
      timeline: timeline.rows,
      top_scored: topScored.rows,
    });
  } catch (err) {
    console.error('[Analytics] Project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/my-stats — developer's own stats (enhanced)
router.get('/my-stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const [result, upcoming, recentCompleted, weekStats, monthStats, completionDates, focusTask, myTags] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) as total_assigned,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'review') as in_review,
          COUNT(*) FILTER (WHERE status = 'done') as completed,
          COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'done') as overdue,
          COALESCE(SUM(story_points) FILTER (WHERE status = 'done'), 0) as completed_points,
          COALESCE(SUM(story_points) FILTER (WHERE status != 'done'), 0) as remaining_points
        FROM tasks WHERE assignee_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id, title, due_date, status, manual_priority, ai_priority_score, project_id
         FROM tasks WHERE assignee_id = $1 AND status != 'done' AND due_date IS NOT NULL
         ORDER BY due_date ASC LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT id, title, completed_at, project_id, story_points
         FROM tasks WHERE assignee_id = $1 AND status = 'done'
         ORDER BY completed_at DESC NULLS LAST LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(story_points), 0) as points
         FROM tasks WHERE assignee_id = $1 AND status = 'done'
           AND completed_at >= date_trunc('week', CURRENT_DATE)`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(story_points), 0) as points
         FROM tasks WHERE assignee_id = $1 AND status = 'done'
           AND completed_at >= date_trunc('month', CURRENT_DATE)`,
        [userId]
      ),
      pool.query(
        `SELECT DISTINCT DATE(completed_at) as date
         FROM tasks WHERE assignee_id = $1 AND status = 'done' AND completed_at IS NOT NULL
         ORDER BY date DESC LIMIT 60`,
        [userId]
      ),
      pool.query(
        `SELECT id, title, ai_priority_score, due_date, manual_priority, project_id, story_points
         FROM tasks WHERE assignee_id = $1 AND status != 'done' AND status != 'blocked'
         ORDER BY ai_priority_score DESC, due_date ASC NULLS LAST LIMIT 1`,
        [userId]
      ),
      pool.query(
        `SELECT UNNEST(tags) as tag, COUNT(*) as count
         FROM tasks WHERE assignee_id = $1 AND tags IS NOT NULL AND array_length(tags, 1) > 0
         GROUP BY tag ORDER BY count DESC LIMIT 20`,
        [userId]
      ),
    ]);

    // Calculate streak: consecutive days with at least one completion
    let streakDays = 0;
    const dates = completionDates.rows.map(r => r.date);
    if (dates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const firstDate = new Date(dates[0]);
      firstDate.setHours(0, 0, 0, 0);

      if (firstDate.getTime() === today.getTime() || firstDate.getTime() === yesterday.getTime()) {
        streakDays = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
          const curr = new Date(dates[i]);
          prev.setHours(0, 0, 0, 0);
          curr.setHours(0, 0, 0, 0);
          const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
          if (diff === 1) {
            streakDays++;
          } else {
            break;
          }
        }
      }
    }

    res.json({
      stats: result.rows[0],
      upcoming_deadlines: upcoming.rows,
      recently_completed: recentCompleted.rows,
      week_stats: weekStats.rows[0],
      month_stats: monthStats.rows[0],
      streak_days: streakDays,
      focus_task: focusTask.rows[0] || null,
      tags: myTags.rows,
    });
  } catch (err) {
    console.error('[Analytics] My stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/trends — 30-day daily created/completed counts
router.get('/trends', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d::date as date,
        COALESCE(COUNT(t.id) FILTER (WHERE t.completed_at::date = d::date), 0) as completed,
        COALESCE(COUNT(t2.id) FILTER (WHERE t2.created_at::date = d::date), 0) as created
      FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day'::interval) d
      LEFT JOIN tasks t ON t.completed_at::date = d::date
      LEFT JOIN tasks t2 ON t2.created_at::date = d::date
      GROUP BY d::date ORDER BY d::date
    `);
    res.json({ days: result.rows });
  } catch (err) {
    console.error('[Analytics] Trends error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/priority-distribution — task counts by priority
router.get('/priority-distribution', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT manual_priority, COUNT(*) as count,
        COUNT(*) FILTER (WHERE status != 'done') as active_count
      FROM tasks GROUP BY manual_priority
    `);
    res.json({ distribution: result.rows });
  } catch (err) {
    console.error('[Analytics] Priority distribution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/user-activity — recent actions across all users (admin/pm only)
router.get('/user-activity', authenticate, requireRole('admin', 'pm'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ta.id, ta.action, ta.old_value, ta.new_value, ta.created_at,
        u.name as user_name, u.avatar_color,
        t.title as task_title, t.project_id
      FROM task_activity ta
      JOIN users u ON ta.user_id = u.id
      JOIN tasks t ON ta.task_id = t.id
      ORDER BY ta.created_at DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Analytics] User activity error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/my-activity — current user's recent activity feed
router.get('/my-activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const [activities, comments] = await Promise.all([
      pool.query(`
        SELECT ta.id, 'activity' as type, ta.action, ta.old_value, ta.new_value, ta.created_at,
          u.name as user_name, t.title as task_title, t.id as task_id, t.project_id
        FROM task_activity ta
        JOIN users u ON ta.user_id = u.id
        JOIN tasks t ON ta.task_id = t.id
        WHERE t.assignee_id = $1
        ORDER BY ta.created_at DESC LIMIT 15
      `, [userId]),
      pool.query(`
        SELECT tc.id, 'comment' as type, tc.content, tc.created_at,
          u.name as user_name, t.title as task_title, t.id as task_id, t.project_id
        FROM task_comments tc
        JOIN users u ON tc.user_id = u.id
        JOIN tasks t ON tc.task_id = t.id
        WHERE t.assignee_id = $1
        ORDER BY tc.created_at DESC LIMIT 10
      `, [userId]),
    ]);

    const merged = [...activities.rows, ...comments.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);

    res.json(merged);
  } catch (err) {
    console.error('[Analytics] My activity error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/project-health — all projects with health classification
router.get('/project-health', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.status,
        COUNT(t.id) as task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'done') as done_count,
        COUNT(t.id) FILTER (WHERE t.status != 'done') as active_count,
        COUNT(t.id) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status != 'done') as overdue_count,
        COUNT(t.id) FILTER (WHERE t.status = 'blocked') as blocked_count,
        COALESCE(AVG(t.ai_priority_score) FILTER (WHERE t.ai_priority_score > 0), 0) as avg_score
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.status = 'active'
      GROUP BY p.id, p.name, p.status
      ORDER BY overdue_count DESC
    `);

    const projects = result.rows.map(p => {
      const activeCount = parseInt(p.active_count) || 1;
      const overdueRatio = parseInt(p.overdue_count) / activeCount;
      const blockedCount = parseInt(p.blocked_count);
      let health = 'green';
      if (overdueRatio > 0.30 || blockedCount > 3) health = 'red';
      else if (overdueRatio > 0.10 || blockedCount > 1) health = 'yellow';
      return { ...p, health };
    });

    res.json(projects);
  } catch (err) {
    console.error('[Analytics] Project health error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
