import { VercelRequest, VercelResponse } from "@vercel/node";
import { createServer } from "../serverInit.js";

// Обработчик Vercel API
export default async (req: VercelRequest, res: VercelResponse) => {
  const hapiServer = await createServer();
  const hapiResponse = await hapiServer.inject({
    method: req.method as any,
    url: req.url!,
    payload: req.body,
    headers: req.headers,
  });

  res.status(hapiResponse.statusCode).send(hapiResponse.result);
};