import { VercelRequest, VercelResponse } from "@vercel/node";
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN as string);

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === "POST") {
    console.log("Webhook received:", req.body);

    bot.processUpdate(req.body);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};