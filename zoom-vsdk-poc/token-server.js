require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const SDK_KEY = process.env.SDK_KEY;
const SDK_SECRET = process.env.SDK_SECRET;

if (!SDK_KEY || !SDK_SECRET) {
  console.error('[Hata] .env dosyasında SDK_KEY ve SDK_SECRET tanımlı olmalı.');
  process.exit(1);
}

/**
 * POST /api/zoom/token
 * Body: { sessionName: string, role: 0 | 1 }
 *   role 0 = katılımcı, role 1 = host
 */
app.post('/api/zoom/token', (req, res) => {
  const { sessionName, role = 1 } = req.body;

  if (!sessionName) {
    return res.status(400).json({ error: 'sessionName zorunlu' });
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 2; // 2 saat geçerli

  const payload = {
    app_key: SDK_KEY,
    tpc: sessionName,
    role_type: role,
    version: 1,
    iat,
    exp,
  };

  const token = jwt.sign(payload, SDK_SECRET);
  console.log(`[Token] "${sessionName}" için token üretildi (role=${role})`);
  res.json({ token });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Token sunucusu: http://localhost:${PORT}`);
});
