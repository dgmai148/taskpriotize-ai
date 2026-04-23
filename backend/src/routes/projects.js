const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects — list all projects
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_count,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') as active_count,
              (SELECT COUNT(DISTINCT t.assignee_id) FROM tasks t WHERE t.project_id = p.id AND t.assignee_id IS NOT NULL) as member_count
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Projects] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects — create project (admin/pm)
router.post('/', authenticate, requireRole('admin', 'pm'), async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(
      `INSERT INTO projects (name, description, status, owner_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description || '', status || 'active', req.user.id]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create', 'project', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ name })]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Projects] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as owner_name FROM projects p
       JOIN users u ON p.owner_id = u.id WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Projects] Get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id
router.put('/:id', authenticate, requireRole('admin', 'pm'), async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const result = await pool.query(
      `UPDATE projects SET name = COALESCE($1,name), description = COALESCE($2,description),
       status = COALESCE($3,status), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [name, description, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1,'update','project',$2,$3)`,
      [req.user.id, req.params.id, JSON.stringify(req.body)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Projects] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id — admin only
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('[Projects] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
