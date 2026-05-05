const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = process.env.SQLITE_PATH || path.join(dbDir, 'taskprio.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// Compatibility wrapper: mimics pg pool.query(sql, params)
// Converts $1,$2,... placeholders to ? and reorders params accordingly
function query(sql, params = []) {
  // Convert $N placeholders to ? and build ordered params array
  const orderedParams = [];
  const convertedSql = sql.replace(/\$(\d+)/g, (_, num) => {
    orderedParams.push(params[parseInt(num) - 1]);
    return '?';
  });

  const trimmed = convertedSql.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
  const hasReturning = /\bRETURNING\b/i.test(convertedSql);

  try {
    const stmt = db.prepare(convertedSql);
    if (isSelect || hasReturning) {
      const rows = stmt.all(...orderedParams);
      return { rows, rowCount: rows.length };
    } else {
      const result = stmt.run(...orderedParams);
      return { rows: [], rowCount: result.changes };
    }
  } catch (err) {
    err.query = sql;
    throw err;
  }
}

const pool = { query };

module.exports = { pool, db };
