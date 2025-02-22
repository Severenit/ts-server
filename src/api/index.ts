import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return res.status(200).json({
      status: 'ok',
      version: '1.0.0',
      endpoints: {
        '/': 'API information',
        '/api/webhook': 'Telegram bot webhook endpoint',
        '/api/setWebhook': 'Set webhook URL endpoint'
      },
      serverTime: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('Error in root handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 