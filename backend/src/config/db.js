const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://taskprio:taskprio_secret@localhost:5432/taskprio',
  max: 20,
  idleTimeoutMillis: 30000,
});

module.exports = { pool };
