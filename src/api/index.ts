import { VercelRequest, VercelResponse } from "@vercel/node";

export default async (req: VercelRequest, res: VercelResponse) => {
  return res.json({
    status: "ok",
    message: "Hello My Vercel Server",
    version: "1.0.0"
  });
}; 