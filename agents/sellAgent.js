async function sellAgent(grok, data, ratio, asset, positionContext) {
  const prompt = `You are a crypto spot sell analyst for ${asset.name}. 

Current position status: ${positionContext || 'Flat - no open position'}

TBO Pro has signaled Close Long. 

Rules (strict):
- If position is FLAT or no open position: VERDICT MUST BE HOLD. Do not analyze exit. Reason: "No open position to sell."
- Only if open: evaluate if distribution risk, overextension, or fading momentum justifies exit.

Current data:
- Price: $${data.Price.toFixed(2)}
- RSI (14): ${data.RSI.toFixed(2)}
- Ratio: ${ratio}x (weak <1.0x = distribution)
- OBV: ${data.OBV ? data.OBV.toFixed(0) : 'N/A'} vs MA (21): ${data['OBV MA'] ? data['OBV MA'].toFixed(0) : 'N/A'}

Think step by step:
1. Check position first — if flat → HOLD immediately.
2. Only if open: does TBO Close Long + weak ratio + momentum fade confirm exit?

Verdict rules:
- HOLD if flat or momentum still decent.
- SELL only if open + strong alignment on risks.

Exact format:
VERDICT: SELL / HOLD
REASON: 2-4 sentences.`;

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
