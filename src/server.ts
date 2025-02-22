import Hapi from '@hapi/hapi';
import bot from "./bot.js";
import { Update } from 'node-telegram-bot-api';

const init = async () => {
  // В development используем порт 3000, в production - порт от Vercel
  const server = Hapi.server({
    port: process.env.NODE_ENV === 'production' ? process.env.PORT : 3000,
    host: '0.0.0.0'
  });

  // Базовый маршрут
  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      return {
        status: 'ok',
        message: 'Hello My Vercel Server',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      };
    }
  });

  // API маршруты
  server.route({
    method: 'GET',
    path: '/api/health',
    handler: (request, h) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };
    }
  });

  // Маршрут для вебхука бота
  server.route({
    method: 'POST',
    path: '/api/webhook',
    handler: async (request, h) => {
      try {
        console.log('Webhook received:', request.payload);
        await bot.processUpdate(request.payload as Update);
        return h.response({ ok: true }).code(200);
      } catch (error) {
        console.error('Error processing webhook:', error);
        return h.response({ error: 'Internal server error' }).code(500);
      }
    }
  });

  await server.start();
  console.log('Server running on %s in %s mode', server.info.uri, process.env.NODE_ENV || 'development');
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();

export default init; 