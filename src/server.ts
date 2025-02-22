// Импорты необходимых модулей
import Hapi from "@hapi/hapi";
import { Update } from "node-telegram-bot-api";
import dotenv from "dotenv";
import bot from "./bot.js"; 
import { WEBHOOK_URL } from "./api/setWebhook.js";

// Загрузка переменных окружения
dotenv.config();

// Конфигурационные параметры
const USE_WEBHOOK = process.env.USE_WEBHOOK === "true";
const PORT = process.env.PORT || 3000;

// Настройка режима работы бота (webhook или long polling)
if (USE_WEBHOOK) {
  bot.setWebHook(WEBHOOK_URL).then(() => console.log("Webhook установлен:", WEBHOOK_URL));
} else {
  console.log("Бот запущен в режиме long polling");
}

// Инициализация и запуск сервера
const init = async () => {
  // Создание Hapi сервера
  const server = Hapi.server({
    port: PORT,
    host: process.env.ENV === "development" ? "localhost" : "0.0.0.0",
  });

  // Маршрут для проверки работоспособности сервера
  server.route({
    method: "GET",
    path: "/",
    handler: async (request, h) => {
      return "Hello My Vercel Server";
    },
  });

  // Маршрут для обработки webhook-сообщений от Telegram
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

  // Запуск сервера
  await server.start();
  console.log(`Hapi сервер запущен на ${server.info.uri}`);

  // Вывод информации о webhook URL в режиме webhook
  if (USE_WEBHOOK) {
    console.log(`Webhook URL: ${WEBHOOK_URL}`);
  }
};

// Запуск приложения
init();