import { VercelRequest, VercelResponse } from "@vercel/node";
import Hapi from "@hapi/hapi";
import axios from "axios";
import bot from "../bot.js";
import { Update } from "node-telegram-bot-api";

interface WebhookInfo {
  ok: boolean;
  result: {
    url: string;
  };
}

let server: Hapi.Server | null = null;
const WEBHOOK_URL = `${process.env.VERCEL_URL}/api/webhook`;

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

// Функция для запуска Hapi-сервера (единожды)
const init = async () => {
  if (!server) {
    server = Hapi.server({
      port: 3000, // Vercel сам определяет порт
      host: "0.0.0.0",
    });

    // Основной API
    server.route({
      method: "GET",
      path: "/",
      handler: () => {
        return { status: "ok", message: "API работает на Vercel 🚀" };
      },
    });

    // Webhook для Telegram
    server.route({
      method: "POST",
      path: "/webhook",
      handler: async (request, h) => {
        try {
          console.log("Webhook received:", request.payload);
          await bot.processUpdate(request.payload as Update);
          return h.response({ success: true }).code(200);
        } catch (error) {
          console.error("Ошибка обработки Webhook:", error);
          return h.response({ error: "Ошибка обработки Webhook" }).code(500);
        }
      },
    });

    await server.initialize(); // Не стартуем сервер, а просто инициализируем его
    await ensureWebhook(); // 🔥 Автоматическая регистрация Webhook
  }

  return server;
};

// Обработчик Vercel API
export default async (req: VercelRequest, res: VercelResponse) => {
  const hapiServer = await init();
  const hapiResponse = await hapiServer.inject({
    method: req.method as any,
    url: req.url!,
    payload: req.body,
    headers: req.headers,
  });

  res.status(hapiResponse.statusCode).send(hapiResponse.result);
};