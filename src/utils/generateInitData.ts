import crypto from 'crypto';
import { BOT_TOKEN } from '../bot.js';

interface GenerateInitDataProps {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export function generateInitData(user: GenerateInitDataProps) {
  const query_id = crypto.randomBytes(12).toString('hex'); // Уникальный query_id
  const auth_date = Math.floor(Date.now() / 1000); // Timestamp
  const userData = encodeURIComponent(JSON.stringify(user));

  // Формируем строку данных
  const data = `query_id=${query_id}&user=${userData}&auth_date=${auth_date}`;

  // Генерируем секретный ключ
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();

  // Генерируем подпись `signature`
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64');

  // Генерируем `hash`
  const hash = crypto.createHmac('sha256', secret).update(signature).digest('hex');

  return { query_id, auth_date, user, signature, hash };
}
