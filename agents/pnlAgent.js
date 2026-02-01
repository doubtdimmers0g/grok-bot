const fs = require('fs').promises;

const POSITION_FILE = 'position.json';
const PNL_FILE = 'pnl.json';

// Load files with error handling
async function loadFiles() {
  let currentPosition = { open: false };
  let pnlData = { cumulative: 0, trades: [] };

  try {
    const posData = await fs.readFile(POSITION_FILE, 'utf8');
    currentPosition = JSON.parse(posData);
  } catch (err) {
    console.error('Position load error—starting fresh:', err.message);
  }

  try {
    const pnlRaw = await fs.readFile(PNL_FILE, 'utf8');
    pnlData = JSON.parse(pnlRaw);
  } catch (err) {
    console.error('PnL load error—starting fresh:', err.message);
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

// Context for Alpha/Telegram
async function getPositionContext(price) {
  const { currentPosition } = await loadFiles();
  if (!currentPosition.open) return 'No open position';

  const unrealizedPct = ((price - currentPosition.entry) / currentPosition.entry * 100).toFixed(1);
  const unrealizedUsd = (price - currentPosition.entry) * (currentPosition.sizeUsd / currentPosition.entry);
  return `Open: $${currentPosition.sizeUsd} at $${currentPosition.entry.toFixed(2)} (${unrealizedPct}% / $${unrealizedUsd.toFixed(2)})`;
}

// Reasoning on position (new Grok call)
async function reasonOnPosition(grok, currentPrice, signalData) {
  const { currentPosition, pnlData } = await loadFiles();
  if (!currentPosition.open) return 'No open position to review';

  const unrealizedPct = ((currentPrice - currentPosition.entry) / currentPosition.entry * 100).toFixed(1);
  const unrealizedUsd = (currentPrice - currentPosition.entry) * (currentPosition.sizeUsd / currentPosition.entry);

const prompt = `Report current position and P&L status factually.

Position data:
- Open: ${currentPosition.open ? 'Yes' : 'No'}
- Entry price: $${currentPosition.entry ? currentPosition.entry.toFixed(2) : 'N/A'}
- Size: $${currentPosition.sizeUsd ? currentPosition.sizeUsd : 'N/A'}
- Current price: $${currentPrice.toFixed(2)}
- Unrealized P&L: ${unrealizedPct}% ($${unrealizedUsd.toFixed(2)})

Overall:
- Cumulative realized P&L: $${pnlData.cumulative}
- Total trades: ${pnlData.trades.length}

Output only facts in bullet points—no suggestions, verdicts, or actions.`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('PnL reasoning error:', err.message);
    return 'Error reviewing position';
  }
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

// Sell execution
async function handleSell(exitPrice) {
  let { currentPosition, pnlData } = await loadFiles();
  if (!currentPosition.open) return 'No position to sell';

  const profitPct = ((exitPrice - currentPosition.entry) / currentPosition.entry * 100).toFixed(1);
  const profitUsd = (exitPrice - currentPosition.entry) * (currentPosition.sizeUsd / currentPosition.entry);

  pnlData.trades.push({
    entry: currentPosition.entry,
    exit: exitPrice,
    sizeUsd: currentPosition.sizeUsd,
    profitPct,
    profitUsd: profitUsd.toFixed(2),
    time: new Date().toISOString()
  });
  pnlData.cumulative = (parseFloat(pnlData.cumulative) + profitUsd).toFixed(2);

  currentPosition.open = false;
  await saveFiles(currentPosition, pnlData);

  return `<b>Paper SELL</b>: $${currentPosition.sizeUsd} at $${exitPrice.toFixed(2)}\nProfit: ${profitPct}% ($${profitUsd.toFixed(2)})\nCumulative: $${pnlData.cumulative}`;
}

module.exports = { getPositionContext, handleBuy, handleSell, reasonOnPosition };