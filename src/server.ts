import 'dotenv/config';
import Hapi from '@hapi/hapi';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Проверка наличия токена
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

if (!process.env.WEBHOOK_URL) {
  console.error('WEBHOOK_URL не установлен в .env файле');
  process.exit(1);
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Инициализация Telegram бота в режиме long polling
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

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

// Маршрут для webhook
server.route({
  method: 'POST',
  path: '/webhook',
  handler: async (request, h) => {
    try {
      console.log("Новое событие:", request.payload);
      return h.response().code(200);
    } catch (error) {
      console.error("Ошибка обработки Webhook:", error);
      return h.response().code(500);
    }
  },
});

// Устанавливаем Webhook для бота
async function setWebhook() {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}`
    );
    console.log("Webhook set:", response.data);
  } catch (error) {
    console.error("Error setting webhook:", error);
  }
}

// Запуск сервера
const init = async () => {
  try {
    await server.start();
    console.log('Server running on %s', server.info.uri);
    await setWebhook();
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

init(); 