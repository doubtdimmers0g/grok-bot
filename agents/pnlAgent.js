const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const COINGECKO_KEY = process.env.COINGECKO_API_KEY;  // if pro; demo might rate-limit

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

// Load position by symbol
async function loadPosition(symbol) {
  try {
    const res = await axios.get(`${SUPABASE_URL}/rest/v1/current_position?symbol=eq.${symbol}&open=eq.true&select=*`, { headers });
    if (res.data.length === 0) return { open: false };
    return res.data[0];
  } catch (err) {
    console.error('Position load error:', err.message);
    return { open: false };
  }
}

// Fetch live price (resilient)
async function getLivePrice(asset) {
  const cgId = asset?.cgId || 'bitcoin';  // safe fallback, but warn
  if (!asset) console.warn('Asset null - using bitcoin as CG fallback');
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_market_cap=false&include_24hr_vol=false&include_24hr_change=false&include_last_updated_at=false`;
    const cgHeaders = COINGECKO_KEY ? { 'x-cg-demo-api-key': COINGECKO_KEY } : {};
    const res = await axios.get(url, { headers: cgHeaders });
    return res.data[cgId.toLowerCase()]?.usd || null;
  } catch (err) {
    console.error('CoinGecko fetch error:', err.response?.data || err.message);
    return null;
  }
}

// Structured context (for index.js note + alpha)
async function getPositionContext(signalPrice, symbol, asset) {
  const position = await loadPosition(symbol);
  if (!position.open) {
    return { isOpen: false };
  }

  // Resilience guard - add this block
    if (typeof position.entry !== 'number' || position.entry <= 0 || typeof position.sizeUsd !== 'number' || position.sizeUsd <= 0) {
      console.warn(`Invalid position data for ${symbol} (missing or invalid entry/sizeUsd) - treating as closed`);
      return { isOpen: false };
    }

  const livePrice = await getLivePrice(asset) || signalPrice;  // live preferred, fallback signal
  const unrealizedPct = ((livePrice - position.entry) / position.entry * 100).toFixed(2);

  return {
    isOpen: true,
    symbol: symbol,
    entryPrice: position.entry,
    sizeUsd: position.sizeUsd,
    unrealizedPct: parseFloat(unrealizedPct),
    details: `Long ${symbol} @ $${position.entry.toFixed(2)} (Unrealized: ${unrealizedPct > 0 ? '+' : ''}${unrealizedPct}%)`
  };
}

// handleBuy
async function handleBuy(sizeUsd = 100, entryPrice, symbol, asset = null) {
  const position = await loadPosition(symbol);
  if (position.open) return `Already open on ${symbol} - skipping`;

  const newPosition = {
    symbol: symbol,
    entry: entryPrice,
    sizeUsd: sizeUsd,
    open: true,
    time: new Date().toISOString()  // if you have column
  };
  await axios.post(`${SUPABASE_URL}/rest/v1/current_position`, newPosition, { headers });

  // Count and log open positions after successful buy
  try {
    const { data: opens } = await axios.get(`${SUPABASE_URL}/rest/v1/current_position?open=eq.true&select=id`, { headers });
    const totalOpens = opens.length;
    console.log(`Opened position on ${symbol} — total concurrent opens: ${totalOpens}`);
  
    // Optional but nice: include in the return message for TG visibility
    buyMsg += `\n(Open positions now: ${totalOpens})`;
  } catch (err) {
    console.error('Failed to count open positions after buy:', err.message);
    // Still proceed - don't block the buy confirmation
  }

  return `<b>BOUGHT</b>: $${sizeUsd} at $${entryPrice.toFixed(4)} (${symbol})`;
}

// handleSell
async function handleSell(exitPrice, symbol, asset = null) {
  const position = await loadPosition(symbol);
  if (!position.open) return `No open position on ${symbol} to sell`;

  // Resilience guard - add this block
  if (typeof position.entry !== 'number' || position.entry <= 0 || typeof position.sizeUsd !== 'number' || position.sizeUsd <= 0) {
    console.warn(`Invalid position data for ${symbol} - cannot sell (missing/invalid entry or sizeUsd)`);
    return `Invalid open position data for ${symbol} - skipping sell (check DB)`;
  }

  const livePrice = await getLivePrice(asset) || exitPrice;
  const profit = (livePrice - position.entry) * (position.sizeUsd / position.entry);

  const trade = {
    symbol: symbol,
    entry: position.entry,
    exit: livePrice,
    sizeUsd: position.sizeUsd,
    profit: profit.toFixed(2),
    time: new Date().toISOString()
  };
  await axios.post(`${SUPABASE_URL}/rest/v1/trades`, trade, { headers });

  // Close position
  await axios.patch(`${SUPABASE_URL}/rest/v1/current_position?symbol=eq.${symbol}&open=eq.true`, 
    { open: false }, { headers });

  // Optional: reload cumulative here or in index.js

  return `<b>SOLD</b>: $${position.sizeUsd.toFixed(0)} at $${livePrice.toFixed(4)} (${symbol})\nProfit: $${profit.toFixed(2)}`;
}

module.exports = { getPositionContext, handleBuy, handleSell, loadPosition /* if needed elsewhere */ };