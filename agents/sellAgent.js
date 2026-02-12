async function sellAgent(grok, data, ratio, asset) {
  const prompt = `You are a crypto spot sell analyst for ${asset.name}. TBO Pro has signaled Close Long—evaluate if distribution risk, overextension, or fading momentum justifies exit to protect gains.

Current data:
- Price: $${data.Price.toFixed(2)}
- RSI (14): ${data.RSI.toFixed(2)} (overbought >65 = stretched)
- Quote Volume USDT: ${data['Quote Volume'].toFixed(0)}
- Quote SMA (30): ${data['Quote Volume SMA'].toFixed(0)}
- Ratio: ${ratio}x (weak <1.0x = distribution)
- OBV: ${data.OBV ? data.OBV.toFixed(0) : 'N/A'}
- OBV MA (21): ${data['OBV MA'] ? data['OBV MA'].toFixed(0) : 'N/A'}

Think step by step:
1. TBO conviction: Close Long suggests fade—does data confirm (weak ratio, momentum fade)?
2. Ratio/inflow: Fading or distribution?
3. RSI/momentum: Overbought or OBV falling?
4. Risk: Hold for more if strong momentum/macro?
5. Overall: Time to lock profits/protect?

Verdict rules:
- SELL if TBO alignment + risks (weak ratio, overextension).
- HOLD if momentum decent or data contradicts TBO.

Exact format:
VERDICT: SELL / HOLD
REASON: 2-4 sentences on TBO alignment, ratio (priority), RSI, momentum fade, risk.`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Sell agent error:', err.message);
    return 'Error in sell review';
  }
}

module.exports = sellAgent;
