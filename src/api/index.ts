import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({
    status: 'ok',
    message: 'Hello My Vercel Server',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
} 