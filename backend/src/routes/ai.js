const express = require('express');
const fetch = require('node-fetch');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5050';

// POST /api/ai/prioritize — run AI prioritization on project tasks
router.post('/prioritize', authenticate, async (req, res) => {
  try {
    const { project_id } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    // Fetch all tasks for the project
    const tasksResult = await pool.query(
      `SELECT t.*,
              (SELECT COUNT(*) FROM task_dependencies td WHERE td.task_id = t.id) as dep_count,
              (SELECT COUNT(*) FROM task_dependencies td WHERE td.depends_on_id = t.id) as blocked_count
       FROM tasks t WHERE t.project_id = $1`,
      [project_id]
    );

    const tasks = tasksResult.rows;
    if (tasks.length === 0) {
      return res.json({ message: 'No tasks to prioritize', updated: 0 });
    }

    // Prepare features for ML service
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

    // Call ML service in batch with timeout
    let mlResponse;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: mlPayload }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (fetchErr) {
      console.error('[AI] ML service unreachable:', fetchErr.message);
      return res.status(503).json({
        error: 'ML service is not available. Please ensure the ML service is running on ' + ML_SERVICE_URL,
        details: fetchErr.message,
      });
    }

    if (!mlResponse.ok) {
      const errText = await mlResponse.text();
      console.error('[AI] ML service error:', errText);
      return res.status(502).json({ error: 'ML service returned an error: ' + errText });
    }

    const predictions = await mlResponse.json();

    // Update each task with AI score and SHAP explanation
    let updated = 0;
    for (const pred of predictions.results) {
      await pool.query(
        `UPDATE tasks SET ai_priority_score = $1, ai_explanation = $2, updated_at = NOW()
         WHERE id = $3`,
        [pred.score, JSON.stringify(pred.explanation), pred.id]
      );
      updated++;
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'ai_prioritize', 'project', $2, $3)`,
      [req.user.id, project_id, JSON.stringify({ tasks_updated: updated })]
    );

    res.json({ message: `${updated} tasks prioritized`, updated, results: predictions.results });
  } catch (err) {
    console.error('[AI] Prioritize error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
