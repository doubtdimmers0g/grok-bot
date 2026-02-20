const axios = require('axios');
const { SUPABASE_URL, headers } = require('./pnlAgent');

async function getValidationReport() {
  try {
    const { data: trades } = await axios.get(`${SUPABASE_URL}/rest/v1/trades?select=*&order=time.asc`, { headers });
    const { data: signals } = await axios.get(`${SUPABASE_URL}/rest/v1/signals?select=*&order=created_at.asc`, { headers });

    if (!signals || signals.length < 20) {
      return `<b>Validation Report</b>\n\nNot enough signals yet (${signals?.length || 0}/20 minimum).\nKeep paper trading.`;
    }

    // Performance from closed trades
    let totalProfit = 0, wins = 0, winAmount = 0, lossAmount = 0;
    let runningTotal = 0, peak = 0, maxDrawdown = 0;

    trades.forEach(t => {
      const p = parseFloat(t.profit) || 0;
      totalProfit += p;
      if (p > 0) { wins++; winAmount += p; } else { lossAmount += Math.abs(p); }

      runningTotal += p;
      if (runningTotal > peak) peak = runningTotal;
      if (peak - runningTotal > maxDrawdown) maxDrawdown = peak - runningTotal;
    });

    const totalTrades = trades.length;
    const winRate = (wins / totalTrades * 100).toFixed(1);
    const profitFactor = lossAmount ? (winAmount / lossAmount).toFixed(2) : '∞';
    const expectancy = (totalProfit / totalTrades).toFixed(2);

    // Signal stats
    const buySignals = signals.filter(s => s.signal_type === 'BUY_SIGNAL').length;
    const sellSignals = signals.filter(s => s.signal_type === 'SELL_SIGNAL').length;
    const buys = signals.filter(s => s.final_verdict === 'BUY').length;
    const passes = signals.filter(s => s.final_verdict === 'PASS').length;
    const holds = signals.filter(s => s.final_verdict === 'HOLD').length;
    const skips = signals.filter(s => s.final_verdict === 'SKIP').length;

    // Simple Go-Live Score
    let score = 40;
    if (winRate >= 55) score += 20;
    if (profitFactor >= 1.6) score += 15;
    if (expectancy >= 2.5) score += 15;
    if (maxDrawdown <= 12) score += 10;
    if (totalTrades >= 40) score += 10;
    score = Math.min(100, Math.max(40, score));

    return `<b>Validation Report — Real-Money Readiness</b>\n\n` +
           `Closed trades: ${totalTrades} | Realized P&L: ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}\n` +
           `Win rate: ${winRate}% | Profit factor: ${profitFactor} | Expectancy: $${expectancy}\n` +
           `Max realized drawdown: $${maxDrawdown.toFixed(2)}\n\n` +
           `Signal stats (${signals.length} total):\n` +
           `Buy signals: ${buySignals} → ${buys} entered (${buySignals ? ((buys/buySignals)*100).toFixed(1) : 0}% acceptance)\n` +
           `Passes: ${passes} | Holds: ${holds} | Skips: ${skips}\n\n` +
           `<b>Go-Live Score: ${score}/100</b>\n` +
           (score >= 80 ? '✅ Strong edge — ready for small real allocation' :
            score >= 65 ? '⚠️ Getting close — need more data' : '⏳ Keep paper trading');
  } catch (err) {
    console.error('Validation error:', err.message);
    return 'Error generating validation report';
  }
}

module.exports = { getValidationReport };