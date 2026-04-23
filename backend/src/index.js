const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');
const { seed } = require('./scripts/seed');

// Route imports
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const aiRoutes = require('./routes/ai');
const notificationRoutes = require('./routes/misc');
const userRoutes = require('./routes/users');
const commentRoutes = require('./routes/comments');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/analytics', analyticsRoutes);

// Audit log route (kept for backward compat)
const { authenticate } = require('./middleware/auth');
app.get('/api/audit-log', authenticate, async (req, res) => {
  try {
    const { limit = 100, entity_type, action } = req.query;
    let query = `SELECT al.*, u.name as user_name, u.avatar_color FROM audit_log al
                 LEFT JOIN users u ON al.user_id = u.id WHERE 1=1`;
    const params = [];
    if (entity_type) { params.push(entity_type); query += ` AND al.entity_type = $${params.length}`; }
    if (action) { params.push(action); query += ` AND al.action = $${params.length}`; }
    params.push(parseInt(limit));
    query += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] Connected to PostgreSQL');
    await seed();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] TaskPrio API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Startup error:', err);
    process.exit(1);
  }
}

start();
