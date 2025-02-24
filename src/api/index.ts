import { VercelRequest, VercelResponse } from "@vercel/node";
import { createServer } from "../serverInit.js";
import { allowCors } from "../middleware/cors.js";

// Обработчик Vercel API
const handler = async (req: VercelRequest, res: VercelResponse) => {
  const hapiServer = await createServer();
  const hapiResponse = await hapiServer.inject({
    method: req.method as any,
    url: req.url!,
    payload: req.body,
    headers: req.headers,
  });

  res.status(hapiResponse.statusCode).send(hapiResponse.result);
};

export default allowCors(handler);