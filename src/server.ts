import Hapi from "@hapi/hapi";
import TelegramBot, { Update } from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();
console.log();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
const USE_WEBHOOK = process.env.USE_WEBHOOK === "true";
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL as string;

const bot = new TelegramBot(BOT_TOKEN, USE_WEBHOOK ? {} : { polling: true });

if (USE_WEBHOOK) {
  bot.setWebHook(WEBHOOK_URL).then(() => console.log("Webhook установлен:", WEBHOOK_URL));
} else {
  console.log("Бот запущен в режиме long polling");
}

const init = async () => {
  const server = Hapi.server({
    port: PORT,
    host: process.env.ENV === "development" ? "localhost" : "0.0.0.0",
  });

  server.route({
    method: "GET",
    path: "/",
    handler: async (request, h) => {
      return "Hello My Vercel Server";
    },
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
    console.log(`Webhook URL: ${WEBHOOK_URL}`);
  }
};

init();