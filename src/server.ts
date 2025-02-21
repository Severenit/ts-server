import 'dotenv/config';
import Hapi from '@hapi/hapi';
import TelegramBot from 'node-telegram-bot-api';

// Проверка наличия токена
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

// Инициализация Telegram бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Создание Hapi сервера
const server = Hapi.server({
  port: 3000,
  host: 'localhost'
});

// Базовый маршрут
server.route({
  method: 'GET',
  path: '/',
  handler: (request, h) => {
    return { message: 'Hello from Hapi server!' };
  }
});

// Обработчик сообщений Telegram
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  console.log('Received message:', msg.text);
  await bot.sendMessage(chatId, `Echo: ${msg.text}`);
});

// Запуск сервера
const init = async () => {
  try {
    await server.start();
    console.log('Server running on %s', server.info.uri);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

init(); 