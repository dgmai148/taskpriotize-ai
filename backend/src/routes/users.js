const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — list users (filterable)
router.get('/', authenticate, async (req, res) => {
  try {
    const { role, is_active, search } = req.query;
    let query = 'SELECT id, name, email, role, avatar_color, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Users] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, avatar_color, is_active, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Include task stats
    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE assignee_id = $1) as assigned_tasks,
         COUNT(*) FILTER (WHERE assignee_id = $1 AND status = 'done') as completed_tasks,
         COUNT(*) FILTER (WHERE assignee_id = $1 AND status IN ('open','in_progress','review','blocked')) as active_tasks
       FROM tasks`,
      [req.params.id]
    );

    res.json({ ...result.rows[0], stats: stats.rows[0] });
  } catch (err) {
    console.error('[Users] Get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — admin creates user
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const validRole = ['admin', 'pm', 'developer'].includes(role) ? role : 'developer';
    const colors = ['#4f46e5', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#65a30d'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, avatar_color)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, avatar_color, is_active, created_at`,
      [email, passwordHash, name, validRole, avatarColor]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create_user', 'user', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ email, name, role: validRole })]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Users] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id — admin updates user
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, role, is_active } = req.body;
    const result = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         role = COALESCE($3, role),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, email, name, role, avatar_color, is_active, created_at`,
      [name, email, role, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update_user', 'user', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify(req.body)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Users] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/password — admin resets password
router.put('/:id/password', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.params.id]);

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'reset_password', 'user', $2, '{}')`,
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('[Users] Password reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id — admin deactivates user
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }
    await pool.query('UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [req.params.id]);

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'deactivate_user', 'user', $2, '{}')`,
      [req.user.id, req.params.id]
    );

    res.json({ message: 'User deactivated' });
  } catch (err) {
    console.error('[Users] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/profile/me — update own profile
router.put('/profile/me', authenticate, async (req, res) => {
  try {
    const { name, avatar_color } = req.body;
    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), avatar_color = COALESCE($2, avatar_color), updated_at = NOW()
       WHERE id = $3 RETURNING id, email, name, role, avatar_color, is_active, created_at`,
      [name, avatar_color, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Users] Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/profile/password — change own password
router.put('/profile/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password required' });
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password changed' });
  } catch (err) {
    console.error('[Users] Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
