const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const {
  jwtPrivateKey, jwtPublicKey, jwtIssuer,
  accessTokenExpiry, refreshTokenExpiry, refreshTokenExpiryMs,
} = require('../config/jwt');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

// Hash a refresh token for DB storage
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Sign a new access token
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    jwtPrivateKey,
    { algorithm: 'RS256', expiresIn: accessTokenExpiry, issuer: jwtIssuer }
  );
}

// Create a refresh token and store its hash in DB
async function createRefreshToken(userId, familyId = null) {
  const token = uuidv4() + '-' + crypto.randomBytes(32).toString('hex');
  const hash = hashToken(token);
  const family = familyId || uuidv4();
  const expiresAt = new Date(Date.now() + refreshTokenExpiryMs);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hash, family, expiresAt]
  );

  return { token, familyId: family };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = ['admin', 'pm', 'developer'].includes(role) ? role : 'developer';

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, avatar_color, created_at`,
      [email, passwordHash, name, userRole]
    );
    const user = result.rows[0];

    const accessToken = signAccessToken(user);
    const { token: refreshToken, familyId } = await createRefreshToken(user.id);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar_color: user.avatar_color },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user);
    const { token: refreshToken } = await createRefreshToken(user.id);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar_color: user.avatar_color },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh — rotate refresh token, detect reuse
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const hash = hashToken(refreshToken);
    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [hash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const storedToken = result.rows[0];

    // Reuse detection: if token was already revoked, revoke entire family
    if (storedToken.revoked) {
      await pool.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = $1',
        [storedToken.family_id]
      );
      console.warn('[Auth] Refresh token reuse detected! Family revoked:', storedToken.family_id);
      return res.status(401).json({ error: 'Refresh token reuse detected. All sessions revoked.' });
    }

    // Check expiration
    if (new Date(storedToken.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Revoke old token
    await pool.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1',
      [storedToken.id]
    );

    // Fetch user
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [storedToken.user_id]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Issue new token pair (same family)
    const accessToken = signAccessToken(user);
    const { token: newRefreshToken } = await createRefreshToken(user.id, storedToken.family_id);

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error('[Auth] Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout — revoke refresh token
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const hash = hashToken(refreshToken);
      await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1', [hash]);
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me — current user info (fetch from DB for full data)
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, avatar_color, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/public-key — expose public key for external verification
router.get('/public-key', (req, res) => {
  res.type('text/plain').send(jwtPublicKey);
});

module.exports = router;
