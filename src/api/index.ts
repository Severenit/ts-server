import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({
    status: "ok",
    version: "1.0.0",
    endpoints: {
      "/": "This documentation",
      "/api/webhook": "Telegram bot webhook",
      "/api/setWebhook": "Set webhook URL for Telegram bot"
    },
    serverTime: new Date().toISOString()
  });
} 