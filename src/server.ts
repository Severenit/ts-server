import 'dotenv/config';
import Hapi from '@hapi/hapi';
import TelegramBot from 'node-telegram-bot-api';

// Проверка наличия токена
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

// Инициализация Telegram бота в режиме long polling
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Обработчик сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  console.log('Received message:', text);
  await bot.sendMessage(chatId, `Echo: ${text}`);
});

// Создание Hapi сервера
const server = Hapi.server({
  port: process.env.PORT || 3000,
  host: '0.0.0.0'
});

// Базовый маршрут
server.route({
  method: 'GET',
  path: '/',
  handler: (request, h) => {
    return { 
      status: 'ok',
      message: 'Server is running'
    };
  }
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