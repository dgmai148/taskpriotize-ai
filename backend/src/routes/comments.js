const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/tasks/:taskId/comments
router.get('/:taskId/comments', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name as user_name, u.avatar_color, u.role as user_role
       FROM task_comments c JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
      [req.params.taskId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Comments] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:taskId/comments
router.post('/:taskId/comments', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const result = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, content) VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.taskId, req.user.id, content.trim()]
    );

    // Get commenter name for notification
    const task = await pool.query('SELECT title, assignee_id, created_by FROM tasks WHERE id = $1', [req.params.taskId]);
    if (task.rows.length > 0) {
      const t = task.rows[0];
      // Notify assignee and creator (if not the commenter)
      const notifyIds = new Set([t.assignee_id, t.created_by].filter(id => id && id !== req.user.id));
      for (const uid of notifyIds) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, message, link)
           VALUES ($1, 'mention', $2, $3)`,
          [uid, `${req.user.name} commented on "${t.title}"`, `/projects/${task.rows[0].project_id || ''}`]
        );
      }

      // Activity log
      await pool.query(
        `INSERT INTO task_activity (task_id, user_id, action, new_value) VALUES ($1, $2, 'comment', $3)`,
        [req.params.taskId, req.user.id, content.trim().substring(0, 100)]
      );
    }

    // Return with user info
    const comment = result.rows[0];
    comment.user_name = req.user.name;
    res.status(201).json(comment);
  } catch (err) {
    console.error('[Comments] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:taskId/comments/:commentId
router.delete('/:taskId/comments/:commentId', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM task_comments WHERE id = $1 AND (user_id = $2 OR $3 IN (\'admin\'))',
      [req.params.commentId, req.user.id, req.user.role]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Comment not found or unauthorized' });
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('[Comments] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/:taskId/activity
router.get('/:taskId/activity', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as user_name, u.avatar_color
       FROM task_activity a JOIN users u ON a.user_id = u.id
       WHERE a.task_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
      [req.params.taskId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Activity] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
