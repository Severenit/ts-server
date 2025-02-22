import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN не найден в .env!");
}

const bot = new TelegramBot(BOT_TOKEN, {
  polling: process.env.USE_WEBHOOK !== "true"
});

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