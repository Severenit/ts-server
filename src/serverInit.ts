import Hapi from "@hapi/hapi";
import axios from "axios";
import bot from "./bot.js";
import { Update } from "node-telegram-bot-api";
import { authRoutes } from './routes/auth.js';

interface WebhookInfo {
  ok: boolean;
  result: {
    url: string;
  };
}

const WEBHOOK_URL = `${process.env.WEBHOOK_URL}/webhook`;

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
        cors: false // Отключаем встроенный CORS Hapi
      }
    });
  
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

  const routes = [
    ...Object.values(authRoutes),
  ];

  server.route(routes);
  
  await server.initialize(); // Не стартуем сервер сразу (для Vercel)
    await ensureWebhook(); // 🔥 Автоматическая регистрация Webhook
  
    // Добавляем глобальную обработку CORS
    server.ext('onPreResponse', (request, h) => {
      const response = request.response;
      if (request.method === 'options') {
        return h.response()
          .header('Access-Control-Allow-Origin', request.headers.origin || 'https://triple-triad-tg-game.netlify.app')
          .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          .header('Access-Control-Allow-Headers', 'Content-Type, telegram-data, Authorization')
          .header('Access-Control-Allow-Credentials', 'true')
          .header('Access-Control-Max-Age', '86400')
          .code(200);
      }

      if (h.response) {
        const responseHeaders = h.response as any;
        responseHeaders.header('Access-Control-Allow-Origin', request.headers.origin || 'https://triple-triad-tg-game.netlify.app');
        responseHeaders.header('Access-Control-Allow-Credentials', 'true');
      }

      return h.continue;
    });
  
    return server;
  };