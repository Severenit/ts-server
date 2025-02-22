import dotenv from "dotenv";
import { createServer } from "./serverInit.js"; // Импорт готового сервера

dotenv.config();

const USE_WEBHOOK = process.env.USE_WEBHOOK === "true";
const WEBHOOK_URL = process.env.WEBHOOK_URL as string;

const init = async () => {
  const server = await createServer(); // Создаём сервер

  await server.start();
  console.log(`🚀 Локальный сервер запущен: ${server.info.uri}`);

  if (USE_WEBHOOK) {
    console.log(`Webhook URL: ${WEBHOOK_URL}`);
  } else {
    console.log("Бот работает в режиме long polling");
  }
};

init();