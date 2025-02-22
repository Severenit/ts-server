import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN не найден в .env!");
}

// В serverless окружении всегда используем webhook режим
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  webHook: true
});

// Обработчики сообщений
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Привет! Я эхо-бот. Отправь мне сообщение, и я отвечу тем же.');
});

bot.on('message', async (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `Эхо: ${msg.text}`);
  }
});

export default bot;