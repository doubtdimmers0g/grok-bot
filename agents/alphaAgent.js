async function alphaAgent(grok, buyVerdict, sellVerdict, getPositionContext, getMarketReasoning) {
  const prompt = `Prime analyst final synthesis for small safe BTC spot trades ($50-100). Prioritize capital protection.

Inputs:
- Buy Agent: ${buyVerdict || 'No buy signal'}
- Sell Agent: ${sellVerdict || 'No sell signal'}
- Position & Live P&L: ${positionContext}
- Market Data: ${marketContext}

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

Exact format:
FINAL VERDICT: BUY / SELL / HOLD / SKIP
REASON: 3-5 sentences synthesizing inputs, market, position, risk.
ACTION: Size $50-100, partial, trail, or no trade. Stops/targets if relevant`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Alpha agent error:', err.message);
    return 'Error in final review';
  }
}

module.exports = alphaAgent;
