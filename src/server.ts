import Hapi from '@hapi/hapi';
import bot from "./bot.js";

const init = async () => {
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
        message: 'Hello My Vercel Server',
        version: '1.0.0'
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
        timestamp: new Date().toISOString()
      };
    }
  });

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();

export default init; 