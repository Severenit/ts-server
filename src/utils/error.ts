import { ResponseToolkit } from '@hapi/hapi';
import bot from '../bot.js';

const ADMIN_CHAT_ID = '1409338';

// Функция для отправки логов в Telegram
export async function sendLogToTelegram(message: string, data?: any) {
  try {
    let formattedMessage = `📝 LOG:\n${message}`;
    
    if (data) {
      const dataString = JSON.stringify(data, null, 2);
      formattedMessage += `\n\nData:\n\`\`\`json\n${dataString}\n\`\`\``;
    }

    await bot.sendMessage(ADMIN_CHAT_ID, formattedMessage, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Failed to send log to Telegram:', err);
  }
}

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
${stack ? `\n📚 Стек:\n\`\`\`\n${stack}\n\`\`\`` : ''}`;

  // Отправляем сообщение в Telegram
  bot.sendMessage(ADMIN_CHAT_ID, errorMessage, { parse_mode: 'Markdown' })
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