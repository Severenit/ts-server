import Hapi from "@hapi/hapi";
import dotenv from "dotenv";
import axios from "axios";
import bot from "./bot.js";
import { Update } from "node-telegram-bot-api";

interface WebhookInfo {
  ok: boolean;
  result: {
    url: string;
  };
}// Общий бот

dotenv.config();

const PORT = process.env.PORT || 3000;
const USE_WEBHOOK = process.env.USE_WEBHOOK === "true";
const WEBHOOK_URL = process.env.WEBHOOK_URL as string;

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

const init = async () => {
  const server = Hapi.server({
    port: PORT,
    host: "0.0.0.0",
  });

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

  await server.start();
  console.log(`Hapi сервер запущен на ${server.info.uri}`);

  if (USE_WEBHOOK) {
    await ensureWebhook();
  } else {
    console.log("Бот работает в режиме long polling");
  }
};

init();