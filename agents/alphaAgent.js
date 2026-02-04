async function alphaAgent(grok, buyVerdict, sellVerdict, positionContext, marketReason) {

  const prompt = `Prime analyst final synthesis for spot crypto market trades. Prioritize capital protection.

Inputs:
- Buy Agent: ${buyVerdict || 'No buy signal'}
- Sell Agent: ${sellVerdict || 'No sell signal'}
- Position & Live P&L: ${positionContext || 'No position context'}
- Market Reasoning: ${marketReason || 'No market reasonging'}

Think step by step:
1. Sub-agent consensus: Strong agreement or conflict?
2. Position risk: Gains to protect or losses to cut?
3. Market momentum: Volume/change confirming trend?
4. Overall: Legit opportunity or trap?

Verdict rules:
- BUY only on strong consensus + clean context.
- SELL on fading + risk.
- HOLD on open with momentum.
- SKIP marginal.

Additional rules for single-position trading:
- If position open and buy signal: SKIP (already in position—hold or wait for sell).
- If no position and sell signal: SKIP (nothing to sell).
- Only BUY to open a new position, SELL to close the existing one.

Exact format:
FINAL VERDICT: BUY / SELL / HOLD
REASON: 3-5 sentences synthesizing inputs, market, position, risk.`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Alpha agent error:', err.message);
    return 'Error in final synthesis';
  }
}

module.exports = alphaAgent;
