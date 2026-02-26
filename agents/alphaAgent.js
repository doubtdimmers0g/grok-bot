async function alphaAgent(grok, buyVerdict, sellVerdict, positionContext, marketReason) {

  const prompt = `Prime analyst final synthesis for spot crypto market trades. Prioritize capital protection in multi-position mode (one open per asset, concurrent across assets).

Inputs:
- Buy Agent: ${buyVerdict || 'No buy signal'}
- Sell Agent: ${sellVerdict || 'No sell signal'}
- Position & Live P&L: ${positionContext || 'No position context'}
- Market Reasoning: ${marketReason || 'No market reasoning'}

Signal rules (strict):
- If this is a SELL SIGNAL (Close Long), completely ignore the Buy Agent. Do not mention and factor it at all in your reasoning.
- If this is a BUY SIGNAL (Open Long), completely ignore the Sell Agent. Do not mention and factor it at all in your reasoning.

Think step by step:
1. Which sub-agent is relevant (e.g. Buy Agent for buy signals, Sell Agent for sell signals)?
2. Position risk per asset: Gains to protect or losses to cut on the signaled coin?
3. Market momentum: Volume/change confirming trend for this asset?
4. Overall: Legit opportunity or trap for the signaled asset?

Verdict rules (strict):
- BUY only if you agree with buy-agent verdict + no open position + clean market context.
- SELL only if you agree with sell-agent verdict + open position on this asset + clean market context.
- PASS only if the signal is marginal, trap risk is high, or data does not justify action (strategic decision, even if position allows it).
- SKIP only if position rules prevent action (e.g. open position on buy signal, no position open on sell signal).
- HOLD only if open position using market, data and sub-agent contexts to determine if continued momentum is showing.

Exact format:
FINAL VERDICT: BUY / SELL / PASS / SKIP / HOLD
REASON: 3-5 sentences synthesizing sub-agent verdicts, position status, market context, and risk.`;

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
