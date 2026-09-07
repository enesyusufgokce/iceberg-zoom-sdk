require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const SDK_KEY = process.env.SDK_KEY;
const SDK_SECRET = process.env.SDK_SECRET;

const PORT = 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.post('/jwt', (req, res) => {
  const { meetingNumber, role } = req.body;

  const iat = Math.round(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;

  const payload = {
    appKey: SDK_KEY,
    sdkKey: SDK_KEY,
    mn: meetingNumber,
    role,
    iat,
    exp,
    tokenExp: exp,
  };

  const signature = jwt.sign(payload, SDK_SECRET, { algorithm: 'HS256' });

  res.json({ signature });
});

app.listen(PORT, () => {
  console.log(`Zoom SDK JWT server running at http://localhost:${PORT}`);
});
