import { Request, ResponseToolkit, ServerRoute } from '@hapi/hapi';
import { errorHandler } from '../utils/error.js';
import { validateTelegramData } from '../utils/validateTelegramData.js';
import { getOrCreatePlayer } from '../keystone-api/user.js';

export const authRoutes: Record<string, ServerRoute> = {
  init: {
    method: 'POST' as const,
    path: '/api/auth',
    handler: async (request: Request, h: ResponseToolkit) => {
      console.log('📌: Received auth request');
      try {
        const telegramData = request.headers['telegram-data'];

        if (!telegramData) {
          console.log('❌: No Telegram data in headers');
          return errorHandler({
            h,
            details: 'No Telegram data provided',
            error: 'Telegram-Data header is required',
            code: 400,
          });
        }

        // TODO: Remove next line
        // console.log('📌: Received Telegram data:', telegramData);

        const user = await validateTelegramData(telegramData);
        if (!user) {
          console.log('❌: Invalid Telegram data');
          return errorHandler({
            h,
            details: 'Invalid Telegram data',
            error: 'Invalid Telegram data',
            code: 400
          })
        }

        console.log('📌: Validated Telegram data:', user);

        const player = await getOrCreatePlayer({
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          photo_url: user.photo_url,
          hash: user.hash,
        });
        console.log('📌: Player created/found:', player);

        return {
          status: 'ok',
          player,
        }
      } catch (e) {
        console.error('❌: Error validating Telegram data:', e);
        return errorHandler({
          h,
          details: 'Failed to validate Telegram data',
          error: e
        });
      }
    }
  },
  getUserData: {
    method: 'GET' as const,
    path: '/api/users/{telegram_id}',
    handler: async (request: Request, h: ResponseToolkit) => {
      try {
        const { telegram_id } = request.params;
        console.log('📌: Getting user data for telegram_id:', telegram_id);

        return {
          status: 'ok',
          data: {
            telegram_id,
            username: 'username',
            first_name: 'first_name',
            last_name: 'last_name'
          }
        }
      } catch (error) {
        console.error('❌: Error getting user data:', error);
        return errorHandler({
          h,
          details: 'Failed to get user data',
          error
        });
      }
    }
  },
}