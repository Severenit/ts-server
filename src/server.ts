import dotenv from "dotenv";
import {join} from 'path';
import Inert from '@hapi/inert';
import { createServer } from "./serverInit.js"; // Импорт готового сервера

dotenv.config();

const USE_WEBHOOK = process.env.USE_WEBHOOK === "true";
const WEBHOOK_URL = process.env.WEBHOOK_URL as string;
const IMG = /\.(jpg|jpeg|gif|png)(\?v=\d+\.\d+\.\d+)?$/;

const init = async () => {
  const server = await createServer();
  await server.register(Inert);

  // Assets
  server.route({
    method: 'GET',
    path: '/img/{path*}',
    handler: (request, h) => {
      if (IMG.test(request.path)) {
        return h.file(join(process.cwd(), 'src', 'game', request.path));
      }
      return h.response('File not found').code(404);
    },
  });// Создаём сервер

  await server.start();
  console.log(`🚀 Локальный сервер запущен: ${server.info.uri}`);

  if (USE_WEBHOOK) {
    console.log(`Webhook URL: ${WEBHOOK_URL}`);
  } else {
    console.log("Бот работает в режиме long polling");
  }
};

init();