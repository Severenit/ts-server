import { Request, ResponseToolkit, ServerRoute } from '@hapi/hapi';
import { errorHandler } from '../utils/error.js';
import { validateTelegramData } from '../utils/validateTelegramData.js';
import { getOrCreatePlayer } from '../keystone-api/user.js';

export const authRoutes: Record<string, ServerRoute> = {
  init: {
    method: 'POST' as const,
    path: '/api/auth',
    handler: async (request: Request, h: ResponseToolkit) => {
      console.log('📌: \'/api/auth\' Получен запрос на авторизацию');
      try {
        const telegramData = request.headers['telegram-data'];

        if (!telegramData) {
          console.log('❌: В заголовках нет данных Telegram');
          return errorHandler({
            h,
            details: 'Необходимо указать заголовок Telegram-Data',
            error: 'Telegram-Data заголовок обязательный',
            code: 400,
          });
        }

        const user = await validateTelegramData(telegramData);
        if (!user) {
          console.log('❌: Неверные данные Telegram');
          return errorHandler({
            h,
            details: 'Неверные данные Telegram',
            error: 'Неверные данные Telegram',
            code: 400
          })
        }

        const player = await getOrCreatePlayer({
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          photo_url: user.photo_url,
          hash: user.hash,
        });

        return {
          status: 'success',
          player,
        }
      } catch (e) {
        console.error('❌: Ошибка валидации данных Telegram:', e);
        return errorHandler({
          h,
          details: 'Не удалось отвалидировать данные Telegram',
          error: e
        });
      }
    }
  },
  getUserData: {
    method: 'GET',
    path: '/api/users/{telegram_id}',
    handler: async (request, h) => {
      try {
        const { telegram_id } = request.params;
        console.log('📌: \'/api/users/{telegram_id}\' Получение данных пользователя для telegram_id:', telegram_id);

        // Получаем данные игрока
        const player = await getOrCreatePlayer({
          id: telegram_id
        });

        if (!player) {
          return errorHandler({
            h,
            details: `Не найден пользователь с telegram_id: ${telegram_id}`,
            error: 'Пользователь не найден',
            code: 404,
          });
        }

        // Получаем карты игрока
        const cards = player.cards;

        // Формируем ответ
        const response = {
          status: 'success',
          player: {
            id: player.id,
            telegram_id: player.telegram_id,
            username: player.username,
            first_name: player.first_name,
            last_name: player.last_name,
            created_at: player.created_at,
            photo_url: player.photo_url,
            cards,
            stats: player.stats,
            activeGame: player?.activeGame || null,
          }
        };

        return response;

      } catch (error) {
        console.error('❌: Error getting user data:', error);
        return h.response({
          error: 'Failed to get user data',
          details: error instanceof Error ? error.message : 'Unknown error'
        }).code(500);
      }
    }
  }
}