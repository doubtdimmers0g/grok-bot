async function alphaAgent(grok, buyVerdict, sellVerdict, positionContext, marketReason) {

  const prompt = `const prompt = Prime analyst final synthesis for spot crypto market trades. Prioritize capital protection in multi-position mode (one open per asset, concurrent across assets).

Inputs:
- Buy Agent: ${buyVerdict || 'No buy signal'}
- Sell Agent: ${sellVerdict || 'No sell signal'}
- Position & Live P&L: ${positionContext || 'No position context'}
- Market Reasoning: ${marketReason || 'No market reasoning'}

Think step by step:
1. Sub-agent consensus: Strong agreement or conflict on this asset?
2. Position risk per asset: Gains to protect or losses to cut on the signaled coin?
3. Market momentum: Volume/change confirming trend for this asset?
4. Overall: Legit opportunity or trap for the signaled asset?

Verdict rules:
- BUY on strong consensus + clean context for the signaled asset (open new if none for this coin).
- SELL on fading + risk for the signaled asset (close if open for this coin).
- HOLD on open with momentum for the signaled asset.
- SKIP marginal or contradicting data.

Exact format:
FINAL VERDICT: BUY / SELL / HOLD / SKIP
REASON: 3-5 sentences synthesizing inputs, market, position per asset, risk.`;

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
