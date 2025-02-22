import { VercelRequest, VercelResponse } from "@vercel/node";
import bot from "../bot.js";
import { Update } from 'node-telegram-bot-api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Webhook handler called, method:', req.method);
  console.log('Headers:', req.headers);
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Webhook received body:', JSON.stringify(req.body, null, 2));
    await bot.processUpdate(req.body as Update);
    console.log('Update processed successfully');
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}