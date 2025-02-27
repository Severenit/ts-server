import { ResponseToolkit } from '@hapi/hapi';
import bot from '../bot.js';

const ADMIN_CHAT_ID = '1409338';

export function errorHandler({
  h,
  details,
  error,
  stack,
  code = 500,
}: {
  h: ResponseToolkit,
  details: string,
  error: unknown,
  code?: number
  stack?: string
})
{
  // Формируем сообщение для Telegram
  const errorMessage = `🚨 Ошибка в приложении:
📝 Детали: ${details}
❌ Ошибка: ${error instanceof Error ? error.message : error}
🔢 Код: ${code}
${stack ? `\n📚 Стек:\n${stack}` : ''}`;

  // Отправляем сообщение в Telegram
  bot.sendMessage(ADMIN_CHAT_ID, errorMessage)
    .catch(err => console.error('Failed to send error to Telegram:', err));

  // Формируем ответ для фронтенда
  const errorResponse = {
    status: 'error',
    code,
    message: details || 'Произошла неизвестная ошибка',
    error: error instanceof Error ? error.message : String(error),
    ...(process.env.NODE_ENV === 'development' && { stack }),
  };

  return h.response(errorResponse).code(code);
}