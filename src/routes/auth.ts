import { Request, ResponseToolkit, ServerRoute } from '@hapi/hapi';

export const authRoutes: Record<string, ServerRoute> = {
  init: {
    method: 'POST' as const,
    path: '/api/auth',
    handler: async (request: Request, h: ResponseToolkit) => {
      return {
        status: 'ok'
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
        return h.response({
          error: 'Failed to get user data',
          details: error instanceof Error ? error.message : 'Unknown error'
        }).code(500);
      }
    }
  },
}