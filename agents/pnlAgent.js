const fs = require('fs').promises;
const axios = require('axios');

const POSITION_FILE = 'position.json';
const PNL_FILE = 'pnl.json';

// Load files with error handling
async function loadFiles() {
  let currentPosition = { open: false };
  let pnlData = { cumulative: 0, trades: [] };

  try {
    currentPosition = JSON.parse(await fs.readFile(POSITION_FILE));
  } catch (err) {
    console.error('Position load error:', err.message);
  }

  try {
    pnlData = JSON.parse(await fs.readFile(PNL_FILE));
  } catch (err) {
    console.error('PnL load error:', err.message);
  }

  return { currentPosition, pnlData };
}

// Save files
async function saveFiles(currentPosition, pnlData) {
  try {
    await fs.writeFile(POSITION_FILE, JSON.stringify(currentPosition, null, 2));
    await fs.writeFile(PNL_FILE, JSON.stringify(pnlData, null, 2));
  } catch (err) {
    console.error('Save error:', err.message);
  }
}

// Fetch live BTC price from CoinGecko
async function getLivePrice() {
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    return res.data.bitcoin.usd;
  } catch (err) {
    console.error('CoinGecko error:', err.message);
    return null;
  }
}

// Context with live price
async function getPositionContext(signalPrice) {
  const { currentPosition } = await loadFiles();
  if (!currentPosition.open) return 'No open position';

  const livePrice = await getLivePrice() || signalPrice;  // fallback to signal price
  const unrealizedPct = ((livePrice - currentPosition.entry) / currentPosition.entry * 100).toFixed(1);
  const unrealizedUsd = (livePrice - currentPosition.entry) * (currentPosition.sizeUsd / currentPosition.entry);

  return `Open: $${currentPosition.sizeUsd} at $${currentPosition.entry.toFixed(2)}, current $${livePrice.toFixed(2)} (unrealized ${unrealizedPct}% / $${unrealizedUsd.toFixed(2)})`;
}

// Buy execution
async function handleBuy(sizeUsd = 75, entryPrice) {
  sizeUsd = sizeUsd || 75;
  let { currentPosition, pnlData } = await loadFiles();
  currentPosition = {
    open: true,
    entry: entryPrice,
    sizeUsd: sizeUsd,
    time: new Date().toISOString()
  };
  await saveFiles(currentPosition, pnlData);
  return `<b>Paper BUY</b>: $${sizeUsd} at $${entryPrice.toFixed(2)}`;
}

// Sell execution with live price
async function handleSell() {
  let { currentPosition, pnlData } = await loadFiles();
  if (!currentPosition.open) return 'No position to sell';

  const livePrice = await getLivePrice() || currentPosition.entry;
  const profit = (livePrice - currentPosition.entry) * (currentPosition.sizeUsd / currentPosition.entry);

  pnlData.trades.push({
    entry: currentPosition.entry,
    exit: livePrice,
    sizeUsd: currentPosition.sizeUsd,
    profit: profit.toFixed(2),
    time: new Date().toISOString()
  });
  pnlData.cumulative = (parseFloat(pnlData.cumulative) + profit).toFixed(2);

  currentPosition.open = false;
  await saveFiles(currentPosition, pnlData);

  return `<b>Paper SELL</b>: $${currentPosition.sizeUsd} at $${livePrice.toFixed(2)}\nProfit: $${profit.toFixed(2)}\nCumulative: $${pnlData.cumulative}`;
}

module.exports = { getPositionContext, handleBuy, handleSell };