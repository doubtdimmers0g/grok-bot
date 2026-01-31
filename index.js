require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.text());

const grok = axios.create({
  baseURL: 'https://api.x.ai/v1',
  headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}` }
});

let lastSignalData = null;  // stores last signal for reply context
let botReady = false;       // only allow replies after first signal
let offset = 0;             // for polling

const buyAgent = require('./agents/buyAgent');
const sellAgent = require('./agents/sellAgent');

function parsePayload(text) {
  const data = {};
  text.split('\n').forEach(line => {
    if (line.includes(':')) {
      const [key, val] = line.split(': ').map(s => s.trim());
      data[key] = parseFloat(val) || val;
    }
  });
  return data;
}

async function sendTelegram(chatId, message) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('Telegram message sent!');
  } catch (err) {
    console.error('Telegram send error:', err.message);
  }
}

// Polling for replies
async function pollUpdates() {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=30`;
  try {
    const res = await axios.get(url);
    for (const update of res.data.result) {
      offset = update.update_id + 1;
      if (update.message && update.message.text && botReady) {  // only reply after first signal
        const chatId = update.message.chat.id;
        const userText = update.message.text.trim();

        const replyPrompt = `User follow-up on last BTC signal: "${userText}"

Last signal data for context:
${JSON.stringify(lastSignalData, null, 2)}

Respond conversationally as the conservative trading analyst. Keep concise and direct.`;

        try {
          const grokRes = await grok.post('/chat/completions', {
            model: 'grok-4-fast-reasoning',
            messages: [{ role: 'user', content: replyPrompt }],
            temperature: 0.4
          });

          const reply = grokRes.data.choices[0].message.content.trim();
          await sendTelegram(chatId, `<b>Grok reply:</b>\n${reply}`);
        } catch (err) {
          await sendTelegram(chatId, 'Thinking... try again.');
          console.error('Grok reply error:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
  setTimeout(pollUpdates, 1000);
}

pollUpdates();  // start polling (replies only after first signal)

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const payload = req.body;
  console.log('Payload received:\n', payload);

  const d = parsePayload(payload);
  if (!d.Price) return console.log('Invalid payload');

  lastSignalData = d;
  botReady = true;

  const ratio = (d['Quote Volume'] / d['Quote Volume SMA']).toFixed(2);

  let verdict, tgHeader;

  if (payload.includes("Buy conditions")) {
    tgHeader = "<b>BTC Buy Signal</b>";
    verdict = await buyAgent(grok, d, ratio);
  } else if (payload.includes("Sell conditions")) {
    tgHeader = "<b>BTC Sell Signal</b>";
    verdict = await sellAgent(grok, d, ratio);
  } else {
    return console.log('Unknown signal type');
  }

  console.log('\nGrok verdict:\n', verdict);

  const tgMessage = `${tgHeader}\nPrice: $${d.Price.toFixed(2)}\nRSI: ${d.RSI.toFixed(2)}\nRatio: ${ratio}x\n\n<b>Grok:</b>\n${verdict}\n\nReply for follow-up.`;

  await sendTelegram(process.env.TELEGRAM_CHAT_ID, tgMessage);
});

app.listen(3000, () => console.log('Bot running - replies after first signal'));
