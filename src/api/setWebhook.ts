import { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import bot from "../bot"; 

// Определение типа ответа от Telegram API
interface WebhookResponse {
  ok: boolean;
  result: {
    url: string;
  };
}

// URL для вебхука, использует переменную окружения VERCEL_URL
export const WEBHOOK_URL = `${process.env.VERCEL_URL}/api/webhook`;

// Функция для проверки и установки вебхука
async function ensureWebhook() {
    try {
        // Получаем текущую информацию о вебхуке
        const response = await axios.get<WebhookResponse>(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`
        );

        // Проверяем, нужно ли обновить вебхук
        if (!response.data.result.url || response.data.result.url !== WEBHOOK_URL) {
          console.log(`Webhook не установлен. Устанавливаю Webhook на: ${WEBHOOK_URL}`);
          await bot.setWebHook(WEBHOOK_URL);
          console.log("Webhook установлен.");
        } else {
          console.log("Webhook уже активен:", response.data.result.url);
        }
    } catch (error) {
        console.error("Ошибка при проверке Webhook:", error);
    }
}

// Автоматическая проверка и установка вебхука при запуске
ensureWebhook();

// Обработчик API endpoint для ручной установки вебхука
export default async (req: VercelRequest, res: VercelResponse) => {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}`
    );

    console.log("Webhook установлен:", response.data);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Ошибка установки Webhook:", error);
    return res.status(500).json({ error: "Ошибка установки Webhook" });
  }
};