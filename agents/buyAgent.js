async function buyAgent(grok, data, ratio) {
  const prompt = `You are a conservative crypto trading analyst focused on small, safe spot buys ($50-100) in BTC dips for 5-10% gains. Prioritize avoiding losses over missing wins—skip marginal or trap dips.

Signal data (TBO-based conditions already met):
- Price: $${data.Price.toFixed(2)}
- RSI (14): ${data.RSI.toFixed(2)} (strong oversold <35, decent 35-42, weak >42)
- Quote Volume USDT: ${data['Quote Volume'].toFixed(0)}
- Quote SMA (30): ${data['Quote Volume SMA'].toFixed(0)}
- Ratio: ${ratio}x (core edge—strong >1.3x real inflow, decent 1.1-1.3x, weak <1.1x = likely trap)
- OBV: ${data.OBV ? data.OBV.toFixed(0) : 'N/A'}
- OBV MA (7): ${data['OBV MA'] ? data['OBV MA'].toFixed(0) : 'N/A'}

Think step by step:
1. Ratio strength: Is inflow convincingly above average? Weak ratio = high skip chance.
2. RSI depth: Real oversold or just neutral pullback?
3. Momentum: OBV rising strongly or above MA? Divergence or slope confirming buyers?
4. Context: Current X/macro sentiment? News/catalysts/red flags (pumps, dumps, mixed = caution)?
5. Overall risk: Legit accumulation or chop/trap in high range?

Verdict rules:
- YES only if strong ratio (>1.2x) + supportive RSI/momentum + clean context.
- SKIP most marginal cases.
- NO if clear downside.

Exact format:
VERDICT: YES / NO / SKIP
REASON: 2-4 sentences on ratio (priority), RSI, momentum, sentiment/risk.
SIZE: $50-100 (higher for stronger signals) or 0`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Buy agent error:', err.message);
    return 'Error in buy review';
  }
}

module.exports = buyAgent;
