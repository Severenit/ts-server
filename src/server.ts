import 'dotenv/config';
import Hapi from '@hapi/hapi';
import TelegramBot from 'node-telegram-bot-api';

// Проверка наличия токена
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const webhookPath = `/webhook/${TELEGRAM_TOKEN}`;

// Инициализация Telegram бота
const bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: { port: 443 } });

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
      message: 'Server is running',
      version: '1.0.0',
      webhook: {
        path: webhookPath
      }
    };
  }
});

// Маршрут для webhook
server.route({
  method: 'POST',
  path: webhookPath,
  handler: async (request, h) => {
    const update = request.payload as any;
    
    if (update?.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      
      console.log('Received message:', text);
      await bot.sendMessage(chatId, `Echo: ${text}`);
    }
    
    return { status: 'ok' };
  }
});

// Запуск сервера
const init = async () => {
  try {
    await server.start();
    console.log('Server running on %s', server.info.uri);
    
    // Установка webhook
    const webhookUrl = `https://vite-server-rho.vercel.app${webhookPath}`;
    await bot.setWebHook(webhookUrl);
    console.log('Webhook set to:', webhookUrl);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

init(); 