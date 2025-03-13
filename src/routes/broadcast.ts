import { Request, ResponseToolkit, ServerRoute } from '@hapi/hapi';
import { errorHandler } from '../utils/error.js';
import { versionCheck } from '../utils/versionCheck.js';
import { getAllUsers } from '../keystone-api/user.js';
import bot from '../bot.js';

interface BroadcastPayload {
  telegram_ids?: string[];
  message: string;
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
        const { telegram_ids, message } = request.payload as BroadcastPayload;

        if (!message) {
          return errorHandler({
            h,
            details: 'Сообщение обязательно для рассылки',
            error: 'Message is required',
            code: 400,
          });
        }

        let targetIds: string[] = [];

        if (telegram_ids && Array.isArray(telegram_ids)) {
          // Если переданы конкретные ID - используем их
          targetIds = telegram_ids;
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
            await bot.sendMessage(telegram_id, message);
            stats.success++;
          } catch (error) {
            stats.failed++;
            stats.errors.push(`Failed to send to ${telegram_id}: ${error.message}`);
            console.error(`❌: Error sending message to ${telegram_id}:`, error);
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