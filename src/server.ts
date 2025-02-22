import Hapi from '@hapi/hapi';

const init = async () => {
  // В production используем порт от Vercel, в development - 3000
  const server = Hapi.server({
    port: process.env.NODE_ENV === 'production' ? process.env.VERCEL_PORT : 3000,
    host: process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'
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
  console.log('Server running on %s in %s mode', server.info.uri, process.env.NODE_ENV || 'development');
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();

export default init; 