import { Card } from '../game/core/card.js';
import { getPlayerCards, restoreUserCards } from '../keystone-api/cards.js';
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

    // Получение всех карт в игре
    getAllCards: {
        method: 'GET' as const,
        path: '/api/cards/all',
        handler: async (request: Request, h: ResponseToolkit) => {
            // Проверяем версию клиента
            const versionError = versionCheck(request, h);
            if (versionError) return versionError;

            try {
                const deck = Card.createDeck();
                
                const response = {
                    status: 'success',
                    cards: deck.map(card => card.toClientObject(false))
                };
                
                return response;
            } catch (e) {
                return errorHandler({
                    h,
                    details: 'Не удалось получить все карты',
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
    },

    // Восстановление карт пользователя
    restoreCards: {
        method: 'POST' as const,
        path: '/api/player/{telegramId}/restore-cards',
        handler: async (request: Request, h: ResponseToolkit) => {
            // Проверяем версию клиента
            const versionError = versionCheck(request, h);
            if (versionError) return versionError;
      
            try {
                const { telegramId } = request.params;
                console.log('🎮 Начинаем восстановление карт для пользователя:', telegramId);
                
                // Получаем текущие карты пользователя
                const currentCards = await getPlayerCards(telegramId);
                console.log('🎮 Текущие карты пользователя:', currentCards.length, 'штук');
                
                // Если у пользователя больше 20 карт, не даем восстановить
                if (currentCards.length >= 20) {
                    console.log('❌ У пользователя слишком много карт:', currentCards.length);
                    return h.response({
                        status: 'error',
                        message: 'У вас уже достаточно карт (20 или больше)'
                    }).code(400);
                }
                
                // Восстанавливаем карты
                console.log('🎮 Начинаем процесс восстановления карт');
                const restoredCards = await restoreUserCards(telegramId);
                console.log('✅ Карты успешно восстановлены:', restoredCards.length, 'штук');
                
                return {
                    status: 'success',
                    message: 'Карты успешно восстановлены',
                    cards: restoredCards
                };
            } catch (e: unknown) {
                const error = e as Error;
                console.error('❌ Ошибка при восстановлении карт:', error);
                console.error('❌ Детали ошибки:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                return errorHandler({
                    h,
                    details: 'Не удалось восстановить карты',
                    error,
                    code: 400,
                });
            }
        }
    }
};