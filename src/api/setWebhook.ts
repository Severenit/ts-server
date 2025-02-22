import { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";

export default async (req: VercelRequest, res: VercelResponse) => {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const WEBHOOK_URL = `${process.env.VERCEL_URL}/api/webhook`;

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