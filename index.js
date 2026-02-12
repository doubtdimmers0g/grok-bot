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

const alphaAgent = require('./agents/alphaAgent');
const buyAgent = require('./agents/buyAgent');
const sellAgent = require('./agents/sellAgent');
const { getPositionContext, handleBuy, handleSell } = require('./agents/pnlAgent');
const { getMarketReasoning } = require('./agents/marketdataAgent');

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
  const lowerPayload = payload.toLowerCase();
  console.log('Payload received:\n', payload);

  // Add symbol parsing here
    const symbolMatch = payload.match(/Symbol[:\s]*([A-Z0-9]+USD?T?)/i);
    const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : 'BTCUSD';  // fallback to BTC

  const d = parsePayload(payload);
  if (!d.Price) return console.log('Invalid payload');

  // Add symbol to data for agents/mapping
  d.Symbol = symbol;

  lastSignalData = d;
  botReady = true;

  const ratio = d['Quote Volume'] && d['Quote Volume SMA'] ? (d['Quote Volume'] / d['Quote Volume SMA']).toFixed(2) : null;

  let buyVerdict = null;
  let sellVerdict = null;
  let tgHeader = "<b>1H Signal</b>";

  if (lowerPayload.includes("buy conditions")) {
    tgHeader = "<b>1H Buy Signal</b>";
    buyVerdict = await buyAgent(grok, d, ratio);
  } else if (lowerPayload.includes("sell conditions")) {
    tgHeader = "<b>1H Sell Signal</b>";
    sellVerdict = await sellAgent(grok, d, ratio);
  } else {
    console.log('Unknown signal type - skipping');
    return;  // guard: no further processing
  }

  // Rare both signals—log and let Alpha resolve
  if (buyVerdict && sellVerdict) {
    console.log('Rare: Both buy and sell signals—Alpha will resolve');
  }

  const positionContext = await getPositionContext(d.Price);
  const marketReason = await getMarketReasoning(grok);
  const finalVerdict = await alphaAgent(grok, buyVerdict, sellVerdict, positionContext, marketReason);

let positionNote = '';
if (positionContext.includes('No open position')) {
  positionNote = `<b>Current position:</b> Flat - no open position\n\n`;
} else if (positionContext.includes('Open')) {
  positionNote = `<b>Current position:</b> ${positionContext}\n\n`;
}
// Else empty if error, but unlikely

let marketNote = '';
if (marketReason && !marketReason.includes('unavailable')) {
  marketNote = `<b>Market Context:</b>\n${marketReason}\n\n`;
} else {
  marketNote = `<b>Market Context:</b> Data unavailable\n\n`;  // fallback grace
}

  let size = 100;

  // Execution
  let executionNote = '';  // default empty if no trade 

  // Extract clean verdict
  const verdictMatch = finalVerdict.match(/FINAL VERDICT:\s*(BUY|SELL|SKIP|HOLD|YES)/i);
  const cleanVerdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'SKIP';
  
  if (cleanVerdict === 'BUY' || cleanVerdict === 'YES') {
    const buyMsg = await handleBuy(size, d.Price);
    executionNote = `<b>Trade executed:</b> ${buyMsg}\n\n`;
  } else if (cleanVerdict === 'SELL') {
    const sellMsg = await handleSell(d.Price);
    executionNote = `<b>Trade executed:</b> ${sellMsg}\n\n`;
  }
  // SKIP/HOLD or unknown: no note, no trade

  // Tighter sub log
  console.log(`Sub: Buy: ${buyVerdict || 'N/A'} | Sell: ${sellVerdict || 'N/A'}`);
  console.log('\nAlpha final:\n', finalVerdict);

  const tgMessage = `${tgHeader}\nPrice: $${d.Price ? d.Price.toFixed(2) : 'N/A'}\nRSI: ${d.RSI ? d.RSI.toFixed(2) : 'N/A'}\nRatio: ${ratio ? ratio + 'x' : 'N/A'}\n\n${positionNote}${marketNote}<b>Buy Agent:</b>\n${buyVerdict || 'No buy signal'}\n\n<b>Sell Agent:</b>\n${sellVerdict || 'No sell signal'}\n\n<b>Alpha Final:</b>\n${finalVerdict}\n\n${executionNote}Reply for follow-up.`;

  await sendTelegram(process.env.TELEGRAM_CHAT_ID, tgMessage);
});

app.listen(3000, () => console.log('Bot running - replies after first signal'));