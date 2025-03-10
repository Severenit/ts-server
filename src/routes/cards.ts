import { Card } from '../game/core/card.js';
import { getPlayerCards } from '../keystone-api/cards.js';
import { Request, ResponseToolkit, ServerRoute } from '@hapi/hapi';
import { errorHandler } from '../utils/error.js';
import { versionCheck } from '../utils/versionCheck.js';

export const cardsRoutes: Record<string, ServerRoute> = {
    // Получение стартовых карт
    getStarterCards: {
        method: 'GET' as const,
        path: '/api/cards/starter',
        handler: async (request: Request, h: ResponseToolkit) => {
            // Проверяем версию клиента
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;

            console.log('Starting /api/cards/starter handler');
            try {
                const deck = Card.createDeck();
                const starterCards = Card.getStarterCards();
                
                const response = {
                    status: 'success',
                    cards: starterCards.map(card => card.toClientObject(false))
                };
                
                return response;
            } catch (e) {
                return errorHandler({
                    h,
                    details: 'Failed to get starter cards',
                    error: e,
                    code: 500,
                });
            }
        }
    },

    // Получение карт пользователя
    getUserCards: {
        method: 'GET' as const,
        path: '/api/player/{telegramId}/cards',
        handler: async (request: Request, h: ResponseToolkit) => {
            // Проверяем версию клиента
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;
      
            try {
                const { telegramId } = request.params;
                // Получаем карты игрока с полной информацией
                const cards = await getPlayerCards(telegramId);
                return {
                    status: 'success',
                    cards: cards
                };

            } catch (e) {
                console.error('Error getting player cards:', e);
                return errorHandler({
                    h,
                    details: 'Failed to get starter cards',
                    error: e,
                    code: 400,
                });
            }
        }
    }
};