import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { VercelRequest, VercelResponse } from '@vercel/node';

// Проверка наличия токена
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Инициализация Telegram бота
const bot = new TelegramBot(TELEGRAM_TOKEN);

// Обработчик для корневого маршрута
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method === 'GET') {
    return response.json({ 
      status: 'ok',
      message: 'Server is running',
      version: '1.0.0'
    });
  }

  const url = request.url || '';
  if (request.method === 'POST' && url.includes('/webhook/')) {
    try {
      const update = request.body;
      
      if (update?.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        
        console.log('Received message:', text);
        await bot.sendMessage(chatId, `Echo: ${text}`);
      }
      
      return response.json({ status: 'ok' });
    } catch (error: unknown) {
      console.error('Error processing webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return response.status(500).json({ 
        status: 'error',
        message: errorMessage 
      });
    }
  }

  return response.status(404).json({ 
    status: 'error',
    message: 'Not found' 
  });
} 