import { VercelRequest, VercelResponse } from "@vercel/node";
import bot from "../bot.js";
import { Update } from 'node-telegram-bot-api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Webhook received:', req.body);
    await bot.processUpdate(req.body as Update);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}