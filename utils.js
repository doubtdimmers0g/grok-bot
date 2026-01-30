function parsePayload(text) {
  const data = {};
  text.split('\n').forEach(line => {
    if (line.includes(':')) {
      const [key, val] = line.split(': ').map(s => s.trim());
      data[key] = parseFloat(val) || val;
    }
  });
  return data;
}

async function sendTelegram(chatId, message, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('Telegram message sent!');
  } catch (err) {
    console.error('Telegram send error:', err.message);
  }
}

module.exports = { parsePayload, sendTelegram };