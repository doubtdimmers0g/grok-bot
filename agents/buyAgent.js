async function buyAgent(grok, data, ratio, asset, positionStatus = 'No open position on SYMBOL' ) {
  const prompt = `You are a crypto spot buy analyst for ${asset.name}.

Current position status: ${positionStatus}

TBO Pro has signaled Open Long — evaluate if this aligns with positive inflow conviction, low trap risk, and supportive momentum for a safe accumulation.

Rules (very important):
- If there is already an open position, you MUST output SKIP.

Current data:
- Price: $${data.Price.toFixed(2)}
- RSI (14): ${data.RSI.toFixed(2)} (oversold <40 = dip support)
- Quote Volume (USD): ${data['Quote Volume'].toFixed(0)}
- Quote SMA (30): ${data['Quote Volume SMA'].toFixed(0)}
- Ratio: ${ratio}x (positive >1.0x = edge, strong >1.3x = conviction)
- OBV: ${data.OBV ? data.OBV.toFixed(0) : 'N/A'}
- OBV MA (21): ${data['OBV MA'] ? data['OBV MA'].toFixed(0) : 'N/A'}

Think step by step:
1. TBO conviction: Open Long suggests breakout—does data confirm (decent ratio, momentum support)?
2. Ratio/inflow: Positive edge or strong surge?
3. RSI/momentum: Oversold support or OBV rising?
4. Risk: Trap flags (high range, weak volume, red macro)?
5. Overall: Safe low-risk entry?

Verdict rules:
- BUY if TBO alignment + supportive data (ratio >1.0x, low risks).
- SKIP if marginal, traps, or data contradicts TBO or if there is already an open position for ${asset.name}.

Exact format:
VERDICT: BUY / SKIP
REASON: 2-4 sentences.`;

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
