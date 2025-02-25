import Hapi, { ResponseToolkit } from '@hapi/hapi';
import Inert from '@hapi/inert';
import axios from "axios";
import path from 'path';
import bot from "./bot.js";
import { Update } from "node-telegram-bot-api";
import { authRoutes } from './routes/auth.js';
import { cardsRoutes } from './routes/cards.js';

interface WebhookInfo {
  ok: boolean;
  result: {
    url: string;
  };
}

const WEBHOOK_URL = `${process.env.WEBHOOK_URL}/webhook`;
const IMG = /\.(jpg|jpeg|gif|png)(\?v=\d+\.\d+\.\d+)?$/;

async function ensureWebhook() {
    try {
      const response = await axios.get<WebhookInfo>(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
  
      if (!response.data.result.url || response.data.result.url !== WEBHOOK_URL) {
        console.log(`Webhook не установлен. Устанавливаю Webhook на: ${WEBHOOK_URL}`);
        await bot.setWebHook(WEBHOOK_URL);
        console.log("Webhook успешно установлен!");
      } else {
        console.log("Webhook уже активен:", response.data.result.url);
      }
    } catch (error) {
      console.error("Ошибка при проверке Webhook:", error);
    }
  }
// Функция для создания сервера (вызывается в `server.ts` и `index.ts`)
export const createServer = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: process.env.ENV === "development" ? "localhost" : "0.0.0.0",
    routes: {
      cors: {
        origin: ['*'],
        credentials: true,
        additionalExposedHeaders: ['content-encoding'],
        exposedHeaders: ['content-encoding'],
        additionalHeaders: ['telegram-data']
      },
      response: {
        emptyStatusCode: 204
      }
    }
  });

  await server.register(Inert);

  // API-запрос для проверки работы сервера
  server.route({
    method: "GET",
    path: "/",
    handler: () => {
      return { status: "ok", message: "API работает 🚀" };
    },
  });

  // Webhook для Telegram
  server.route({
    method: 'POST',
    path: '/webhook',
    handler: async (request, h) => {
      try {
        console.log('Webhook received:', request.payload);
        await bot.processUpdate(request.payload as Update);
        return h.response({ success: true }).code(200);
      } catch (error) {
        console.error('Ошибка обработки Webhook:', error);
        return h.response({ error: 'Ошибка обработки Webhook' }).code(500);
      }
    },
  });

  // Assets
  server.route({
    method: 'GET',
    path: '/img/{path*}',
    handler: (request, h) => {
      if (IMG.test(request.path)) {
        console.log(request.path);
        return h.file(path.join(process.cwd(), 'src', 'game', request.path));
      }
      return h.response('File not found').code(404);
    },
  });

  const routes = [
    ...Object.values(authRoutes),
    ...Object.values(cardsRoutes)
  ];

  server.route(routes);
  
  await server.initialize(); // Не стартуем сервер сразу (для Vercel)
  await ensureWebhook(); // 🔥 Автоматическая регистрация Webhook
  
  return server;
};