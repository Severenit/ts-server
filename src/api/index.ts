import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return res.status(200).json({
      status: 'ok',
      message: 'Hello My Vercel Server',
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Error in root handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 