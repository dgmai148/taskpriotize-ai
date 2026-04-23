const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate or load RSA key pair for JWT RS256 signing
function loadOrGenerateKeys() {
  const keysDir = path.join(__dirname, '../../keys');
  const privPath = path.join(keysDir, 'private.pem');
  const pubPath = path.join(keysDir, 'public.pem');

  if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
    return {
      privateKey: fs.readFileSync(privPath, 'utf8'),
      publicKey: fs.readFileSync(pubPath, 'utf8'),
    };
  }

  console.log('[JWT] Generating RS256 key pair...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
  fs.writeFileSync(privPath, privateKey, { mode: 0o600 });
  fs.writeFileSync(pubPath, publicKey);
  console.log('[JWT] Key pair saved to /keys');

  return { privateKey, publicKey };
}

const keys = loadOrGenerateKeys();

module.exports = {
  jwtPrivateKey: keys.privateKey,
  jwtPublicKey: keys.publicKey,
  jwtIssuer: process.env.JWT_ISSUER || 'taskprio-app',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000,
};
