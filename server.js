const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// POST /chat - receives { message: '...' } and forwards to Rasa
app.post('/chat', async (req, res) => {
  console.log('[Backend] /chat request received:', req.body);
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    console.log('[Backend] Invalid message payload');
    return res.status(400).json({ error: 'Invalid message payload' });
  }

  try {
    console.log('[Backend] Forwarding message to Rasa:', message);

    // Rasa REST webhook expects { sender, message }
    const rasaResponse = await axios.post('http://localhost:5005/webhooks/rest/webhook', {
      sender: 'web_user',
      message: message
    }, { timeout: 10000 });

    console.log('[Backend] Received from Rasa:', rasaResponse.data);

    // Normalize Rasa response into an array of { type, text?, image? }
    const responses = Array.isArray(rasaResponse.data) ? rasaResponse.data.map(item => {
      if (item.hasOwnProperty('text')) return { type: 'text', text: item.text };
      if (item.hasOwnProperty('image')) return { type: 'image', image: item.image };
      // pass other payloads through
      return { type: 'unknown', raw: item };
    }) : [];

    console.log('[Backend] Returning to frontend:', responses);
    return res.json({ responses });
  } catch (err) {
    console.error('[Backend] Error while communicating with Rasa:', err.message || err);
    return res.status(500).json({ error: 'Failed to communicate with Rasa', details: err.message || String(err) });
  }
});

// Fallback to serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`[Backend] Server listening on http://localhost:${PORT}`));
