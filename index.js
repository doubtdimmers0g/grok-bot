require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.text());

const grok = axios.create({
  baseURL: 'https://api.x.ai/v1',
  headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}` }
});

let lastSignalData = null;
let botReady = false;
let offset = 0;

const alphaAgent = require('./agents/alphaAgent');
const buyAgent = require('./agents/buyAgent');
const sellAgent = require('./agents/sellAgent');
const { getPositionContext, handleBuy, handleSell, SUPABASE_URL, headers } = require('./agents/pnlAgent');
const { getMarketReasoning } = require('./agents/marketdataAgent');
const { getValidationReport } = require('./agents/validationAgent');

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

let telegramQueue = [];
let isSending = false;

async function sendTelegram(chatId, message) {
  return new Promise((resolve) => {
    telegramQueue.push({ chatId, message, resolve });

    if (!isSending) {
      processQueue();
    }
  });
}

async function processQueue() {
  if (isSending || telegramQueue.length === 0) return;

  isSending = true;
  const { chatId, message, resolve } = telegramQueue.shift();

  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('Telegram message sent!');
  } catch (err) {
    console.error('Telegram send error:', err.message);
  }

  resolve();

  // Safe delay between messages (Telegram likes ~800ms+ between sends)
  setTimeout(() => {
    isSending = false;
    processQueue();
  }, 900);
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
        if (userText.toLowerCase() === '/validate') {
          const report = await getValidationReport();
          await sendTelegram(chatId, report);
          return;
        }
        const replyPrompt = `User follow-up on last signal: "${userText}"

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

  // Symbol parsing early
const symbolRaw = payload.match(/Symbol[:\s]*([A-Z0-9]+USD?T?)/i)?.[1] || 'BTCUSD';
let symbol = symbolRaw.toUpperCase().replace(/USDT$/i, 'USD');  // Normalize USDT to USD
if (!symbol.endsWith('USD')) symbol += 'USD';  // Force suffix if missing

  // Add asset resolution (hardcoded map)
  const assetMap = {
    'BTCUSD': { cgId: 'bitcoin', name: 'Bitcoin' },
    'ETHUSD': { cgId: 'ethereum', name: 'Ethereum' },
    'SOLUSD': { cgId: 'solana', name: 'Solana' },
    'SUIUSD': { cgId: 'sui', name: 'Sui' },
    'XRPUSD': { cgId: 'ripple', name: 'XRP' },
    'AEROUSD': { cgId: 'aerodrome-finance', name: 'Aerodrome' },
    'ONDOUSD': { cgId: 'ondo-finance', name: 'Ondo' },
    'HBARUSD': { cgId: 'hedera-hashgraph', name: 'Hedera' },
    'SEIUSD': { cgId: 'sei-network', name: 'Sei' },
    'LINKUSD': { cgId: 'chainlink', name: 'Chainlink' },
    'MORPHOUSD': { cgId: 'morpho', name: 'Morpho' },
    // add USDT variants if needed
  };
  const asset = assetMap[symbol] || assetMap['BTCUSD'];  // fallback
   
  const d = parsePayload(payload);
  if (!d.Price) return console.log('Invalid payload');

  d.Symbol = symbol;  // for agents/future mapping
  lastSignalData = d;
  botReady = true;

  const ratio = d['Quote Volume'] && d['Quote Volume SMA'] ? (d['Quote Volume'] / d['Quote Volume SMA']).toFixed(2) : null;

  const positionContext = await getPositionContext(d.Price, symbol, asset);

  //Clean, consistent string for agents AND Telegram
  let positionStatus = `No open position on ${symbol}`;
  let positionNote = `<b>Current position:</b> No open position on ${symbol}\n\n`;
  
  if (positionContext.isOpen) {
    positionStatus = positionContext.details;
    positionNote = `<b>Current position:</b> ${positionContext.details}\n\n`;
  }

  let buyVerdict = null;
  let sellVerdict = null;
  let tgHeader = `<b>1H ${asset.name || symbol} Signal</b>`;  // default with symbol

  if (lowerPayload.includes("buy conditions")) {
    tgHeader = `<b>1H ${asset.name || symbol} Buy Signal</b>`;
    buyVerdict = await buyAgent(grok, d, ratio, asset, positionStatus);
  } else if (lowerPayload.includes("sell conditions")) {
    tgHeader = `<b>1H ${asset.name || symbol} Sell Signal</b>`;
    sellVerdict = await sellAgent(grok, d, ratio, asset, positionStatus);
  } else {
    console.log('Unknown signal type - skipping');
    return;
  }

  // Rare both signals—log and let Alpha resolve
  if (buyVerdict && sellVerdict) {
    console.log('Rare: Both buy and sell signals—Alpha will resolve');
  }

  const marketReason = await getMarketReasoning(grok, asset);
  const finalVerdict = await alphaAgent(grok, buyVerdict, sellVerdict, positionContext, marketReason);

  let marketNote = '';
  if (marketReason && !marketReason.includes('unavailable')) {
    marketNote = `<b>Market Context:</b>\n${marketReason}\n\n`;
  } else {
    marketNote = `<b>Market Context:</b> Data unavailable\n\n`;
  }

  let size = 100;
  let executionNote = ''; 

  const verdictMatch = finalVerdict.match(/FINAL VERDICT:\s*(BUY|SELL|PASS|SKIP|HOLD|YES)/i);
  const cleanVerdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'SKIP';
    // Log every signal for validation tracking
    const signalType = lowerPayload.includes("buy conditions") ? 'BUY_SIGNAL' : 'SELL_SIGNAL';
    await axios.post(`${SUPABASE_URL}/rest/v1/signals`, {
      symbol,
      signal_type: signalType,
      final_verdict: cleanVerdict,
      ratio: ratio ? parseFloat(ratio) : null,
      price: d.Price
    }, { headers }).catch(err => console.error('Signal log error:', err.message));
    
  if (cleanVerdict === 'BUY' || cleanVerdict === 'YES') {
    const buyMsg = await handleBuy(size, d.Price, symbol, asset);
    
    executionNote = `<b>Trade executed:</b> ${buyMsg}\n\n`;
  } else if (cleanVerdict === 'SELL') {
    const sellMsg = await handleSell(d.Price, symbol, asset);
    executionNote = `<b>Trade executed:</b> ${sellMsg}\n\n`;
  }
  // SKIP/HOLD or unknown: no note, no trade

  // Tighter sub log
  console.log(`Sub: Buy: ${buyVerdict || 'N/A'} | Sell: ${sellVerdict || 'N/A'}`);
  console.log('\nAlpha final:\n', finalVerdict);

  const tgMessage = `${tgHeader}\nPrice: $${d.Price ? d.Price.toFixed(2) : 'N/A'}\nRSI: ${d.RSI ? d.RSI.toFixed(2) : 'N/A'}\nRatio: ${ratio ? ratio + 'x' : 'N/A'}\n\n${positionNote}${marketNote}<b>Buy Agent:</b>\n${buyVerdict || 'No buy signal'}\n\n<b>Sell Agent:</b>\n${sellVerdict || 'No sell signal'}\n\n<b>Alpha Final:</b>\n${finalVerdict}\n\n${executionNote}Reply for follow-up.`;

  await sendTelegram(process.env.TELEGRAM_CHAT_ID, tgMessage);
});

async function startServer() {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Bot running on port ${PORT} - replies after first signal`));
}
  
startServer();