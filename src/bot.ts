import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не найден в .env!");
}

// Инициализируем бота в режиме webhook
const bot = new TelegramBot(token, {
  webHook: true
});

// Обработчики сообщений
bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    console.log('Received /start command from chat:', chatId);
    await bot.sendMessage(chatId, 'Привет! Я эхо-бот. Отправь мне сообщение, и я отвечу тем же.');
  } catch (error) {
    console.error('Error handling /start command:', error);
  }
});

bot.on('message', async (msg) => {
  try {
    if (msg.text && !msg.text.startsWith('/')) {
      const chatId = msg.chat.id;
      console.log('Received message:', msg.text, 'from chat:', chatId);
      await bot.sendMessage(chatId, `Эхо: ${msg.text}`);
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

export default bot;