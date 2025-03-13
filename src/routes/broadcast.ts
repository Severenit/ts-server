import { Request, ResponseToolkit, ServerRoute } from '@hapi/hapi';
import { errorHandler } from '../utils/error.js';
import { versionCheck } from '../utils/versionCheck.js';
import { getAllUsers } from '../keystone-api/user.js';
import bot from '../bot.js';

interface BroadcastPayload {
  telegram_ids?: string[];
  message: string;
  parse_mode?: 'Markdown' | 'HTML';
}

export const broadcastRoutes: Record<string, ServerRoute> = {
  broadcast: {
    method: 'POST' as const,
    path: '/api/broadcast',
    handler: async (request: Request, h: ResponseToolkit) => {
      // Проверяем версию клиента
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;

      try {
        const { telegram_ids, message, parse_mode = 'Markdown' } = request.payload as BroadcastPayload;
        const tgIds = typeof telegram_ids === 'string' ? JSON.parse(telegram_ids) : telegram_ids;
        console.log('tgIds', tgIds);
        console.log('message', message);
        console.log('telegram_ids', telegram_ids);
        if (!message) {
          return errorHandler({
            h,
            details: 'Сообщение обязательно для рассылки',
            error: 'Message is required',
            code: 400,
          });
        }

        // Проверяем корректность Markdown разметки
        if (parse_mode === 'Markdown' && !isValidMarkdown(message)) {
          return errorHandler({
            h,
            details: 'Некорректная Markdown разметка',
            error: 'Invalid Markdown syntax',
            code: 400,
          });
        }

        let targetIds: string[] = [];

        if (telegram_ids && Array.isArray(tgIds)) {
          // Если переданы конкретные ID - используем их
          targetIds = tgIds;
        } else {
          // Если ID не переданы - получаем всех пользователей
          targetIds = await getAllUsers();
        }

        if (targetIds.length === 0) {
          return errorHandler({
            h,
            details: 'Нет пользователей для рассылки',
            error: 'No users found',
            code: 404,
          });
        }

        // Счетчики для статистики
        const stats = {
          total: targetIds.length,
          success: 0,
          failed: 0,
          errors: [] as string[],
        };

        // Рассылаем сообщения
        for (const telegram_id of targetIds) {
          try {
            await bot.sendMessage(telegram_id, message, { parse_mode });
            stats.success++;
          } catch (error) {
            stats.failed++;
            if (error instanceof Error) {
              stats.errors.push(`Failed to send to ${telegram_id}: ${error.message}`);
              console.error(`❌: Error sending message to ${telegram_id}:`, error);
            } else {
              stats.errors.push(`Failed to send to ${telegram_id}: Unknown error`);
              console.error(`❌: Error sending message to ${telegram_id}:`, 'Unknown error');
            }
          }
        }

        return {
          status: 'success',
          message: 'Рассылка выполнена',
          stats,
        };
      } catch (error) {
        return errorHandler({
          h,
          details: 'Ошибка при выполнении рассылки',
          error,
          code: 500,
        });
      }
    },
  },
};

// Простая валидация Markdown синтаксиса
function isValidMarkdown(text: string): boolean {
  // Проверяем парность символов разметки
  const pairs = {
    '*': 0,  // bold
    '_': 0,  // italic
    '`': 0,  // code
    '[': 0,  // links
    ']': 0
  };

  for (const char of text) {
    if (char in pairs) {
      pairs[char as keyof typeof pairs]++;
    }
  }

  // Все парные символы должны быть четными
  return Object.values(pairs).every(count => count % 2 === 0);
} 