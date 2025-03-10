import { ServerRoute } from '@hapi/hapi';

import { Game } from '../game/core/game.js';

import { createActiveGame, deleteActiveGame, getActiveGameByGameId, updateUserStats } from '../keystone-api/game.js';
import { errorHandler, sendLogToTelegram } from '../utils/error.js';
import { GameState, PlayerCard } from '../types/game.js';
import { Card } from '../game/core/card.js';
import { addCardToPlayer, deletePlayerCard } from '../keystone-api/user.js';
import { API_VERSION, MIN_SUPPORTED_VERSION, versionCheck } from '../utils/versionCheck.js';

// Вспомогательная функция для восстановления объектов карт
function restoreCards(cards: PlayerCard[], boardName: string) {
  console.log('cards', cards);
  if (!cards) {
    sendLogToTelegram('Массив карт пустой или не определен');
    return [];
  }

  // sendLogToTelegram('🔄 Восстанавливаем карты - ' + boardName, { cards: cards.map(c => c?.id) });

  const deck = Card.createDeck();

  return cards.map(cardData => {
    // Если это пустая позиция на доске, просто возвращаем null без логирования
    if (!cardData) {
      return null;
    }

    if (!cardData.id) {
      const message = '⚠️ Card data has no ID';
      console.log(message, cardData);
      sendLogToTelegram(message, cardData);
      return null;
    }

    const card = deck.find((c: Card) => c.id === cardData.id);
    if (!card) {
      const message = `❌ Card ${cardData.id} not found in deck`;
      console.log(message);
      sendLogToTelegram(message);
      return null;
    }

    try {
      const restoredCard = card.clone();

      if (!restoredCard) {
        const message = `❌ Failed to clone card ${card.id}`;
        console.log(message);
        sendLogToTelegram(message);
        return null;
      }

      restoredCard.owner = cardData.owner;
      restoredCard.position = cardData.position;

      console.log(`✅ Успешно восстановили карту ${cardData.id}`);
      return restoredCard;
    } catch (error) {
      const message = `❌ Error restoring card ${cardData.id}`;
      console.error(message, error);
      sendLogToTelegram(message, { error, cardData });
      return null;
    }
  }).filter((card: Card | null): card is Card => card !== null);
}

const nonExistentGames = new Set();

// Флаг технического обслуживания
const MAINTENANCE_MODE = false;

// Map для отслеживания количества запросов
const requestCounts = new Map();

// Функция для логирования запросов
async function logRequest(gameId: string, telegramData: string, request: any) {
  const now = Date.now();
  const key = `${gameId}_${request.info.remoteAddress}`;
  const count = (requestCounts.get(key) || 0) + 1;
  requestCounts.set(key, count);

  if (count > 10) { // Если больше 10 запросов от одного IP к одной игре
    await sendLogToTelegram('🚨 Подозрительная активность', {
      gameId,
      ip: request.info.remoteAddress,
      userAgent: request.headers['user-agent'],
      requestCount: count,
      path: request.path,
      method: request.method,
      timestamp: new Date().toISOString(),
      referer: request.headers.referer || 'unknown',
      telegramData,
    });

    // Если игра не существует и запросы продолжаются, добавляем в чёрный список
    if (nonExistentGames.has(gameId)) {
      return true; // Сигнализируем о необходимости блокировки запроса
    }
  }
  return false;
}

interface PlayerCardSettings {
  cardInfo: {
    id: string;
  };
}

interface GamePayload {
  level: number;
  settings: {
    userId: string; playerCards?: Array<PlayerCardSettings>;
  };
}

interface PlayerMovePayload {
  cardIndex: number;
  position: number;
}

interface ExchangeCardPayload {
  cardId: string;
}

interface UpdateGameStatsPayload {
  statsId: string;
  isWin: boolean;
  isDraw: boolean;
  wonCards: string[];
  lostCards: string[];
}

export const gameRoutes: Record<string, ServerRoute> = {
  // Получение версии API
  getVersion: {
    method: 'GET' as const,
    path: '/api/version',
    handler: async (request, h) => {
      return {
        version: API_VERSION,
        minSupported: MIN_SUPPORTED_VERSION
      };
    }
  },

  // Создание новой игры
  createGame: {
    method: 'POST' as const,
    path: '/api/game/new',
    handler: async (request, h) => {
      // Проверяем версию клиента
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;

      // Проверка на техническое обслуживание
      if (MAINTENANCE_MODE) {
        return errorHandler({
          h,
          details: 'Сервер временно недоступен. Проводятся технические работы.',
          error: 'Maintenance',
          code: 503
        });
      }

      try {
        const gameId = Date.now().toString();
        const { settings: s, level } = request.payload as GamePayload;
        const settings: GamePayload['settings'] = typeof s === 'string' ? JSON.parse(s) : s;

        if (!settings?.userId) {
          throw new Error('ID пользователя обязательно для создания игры');
        }

        const gameSettings = {
          AI_PLAYER: 'BALANCED',
          AI_OPPONENT: 'BALANCED',
          ...settings,
        };

        const rules = {
          OPEN: level < 2,
          SAME: level > 3,
          SAME_WALL: level > 4,
          PLUS: level > 5,
          COMBO: level > 6,
          ELEMENTAL: level > 7,
          SUDDEN_DEATH: level > 8,
        };

        const game = new Game(gameSettings, rules);
        let playerCardIds: string[] = [];

        if (settings?.playerCards && Array.isArray(settings.playerCards)) {
          playerCardIds = settings.playerCards.map(card => card.cardInfo.id);
        }

        if (playerCardIds.length !== 5) {
          throw new Error(`Ожидалось 5 карт игрока, но получено ${playerCardIds.length}`);
        }

        const gameState = game.initializeGame(playerCardIds) as GameState;
        
        // Создаем запись об игре в базе данных
        const activeGame = await createActiveGame(String(settings.userId), gameId, gameState, true);

        return {
          gameId,
          status: 'created',
          gameState,
          activeGame: {
            id: activeGame.id,
            gameId: activeGame.gameId,
          },
        };
      } catch (error) {
        console.error('❌ Ошибка при создании игры:', error);
        console.error('❌ Стек ошибки:', (error as Error).stack);
        return errorHandler({
          h,
          details: (error as Error).message,
          error: 'Не удалось создать игру',
          stack: (error as Error).stack,
          code: 500,
        });
      }
    },
  },

  // Получение состояния игры
  getGameState: {
    method: 'GET' as const,
    path: '/api/game/{gameId}',
    handler: async (request, h) => {
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;

      const { gameId } = request.params;
      const telegramData = request.headers['telegram-data'];
      await logRequest(gameId, telegramData, request);

      if (nonExistentGames.has(gameId)) {
        return errorHandler({
          h,
          details: 'Игра завершена или не существует. Пожалуйста, начните новую игру.',
          error: 'Game not found',
          code: 410
        });
      }

      try {
        const activeGame = await getActiveGameByGameId(gameId);

        if (!activeGame) {
          nonExistentGames.add(gameId);
          return errorHandler({
            h,
            details: 'Игра не найдена',
            error: 'Game not found',
            code: 404
          });
        }

        const savedState = activeGame.gameState;
        const game = new Game(savedState.settings || {}, savedState.rules || {});

        // Восстанавливаем карты
        game.board = restoreCards(savedState.board, 'board');
        game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
        game.aiHand = restoreCards(savedState.aiHand, 'aiHand');
        game.originalPlayerCards = savedState.originalPlayerCards 
          ? restoreCards(savedState.originalPlayerCards, 'originalPlayerCards')
          : game.playerHand.map((card: Card) => card.clone());
        game.originalAiCards = savedState.originalAiCards
          ? restoreCards(savedState.originalAiCards, 'originalAiCards')
          : game.aiHand.map((card: Card) => card.clone());

        // Восстанавливаем остальное состояние
        game.currentTurn = savedState.currentTurn || 'player';
        game.playerScore = savedState.playerScore || 5;
        game.aiScore = savedState.aiScore || 5;
        game.gameStatus = savedState.gameStatus || 'playing';
        game.winner = savedState.winner || null;
        game.suddenDeathRound = savedState.suddenDeathRound || 0;
        game.boardElements = Array.isArray(savedState.boardElements) 
          ? savedState.boardElements 
          : Array(9).fill(null);
        game.cardExchange = savedState.cardExchange || null;

        return game.getState();
      } catch (error) {
        console.error('Error getting game state:', error);
        return errorHandler({
          h,
          details: 'Ошибка при получении состояния игры',
          error,
          code: 500
        });
      }
    }
  },

  // Выполнение хода игрока
  playerMove: {
    method: 'POST' as const,
    path: '/api/game/{gameId}/player-move',
    handler: async (request, h) => {
      // Проверяем версию клиента
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;

      // Проверка на техническое обслуживание
      if (MAINTENANCE_MODE) {
        return errorHandler({
          h,
          details: 'Сервер временно недоступен. Проводятся технические работы.',
          error: 'Maintenance',
          code: 503
        });
      }

      const { gameId } = request.params;
      const { cardIndex, position } = request.payload as PlayerMovePayload;

      try {
        const activeGame = await getActiveGameByGameId(gameId);

        if (!activeGame) {
          return errorHandler({
            h,
            details: 'Игра не найдена',
            error: 'Game not found',
            code: 404
          });
        }

        const savedState = activeGame.gameState;
        const game = new Game(savedState.settings || {}, savedState.rules || {});

        // Восстанавливаем состояние
        game.board = restoreCards(savedState.board, 'board');
        game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
        game.aiHand = restoreCards(savedState.aiHand, 'aiHand');
        game.originalPlayerCards = savedState.originalPlayerCards
          ? restoreCards(savedState.originalPlayerCards, 'originalPlayerCards')
          : game.playerHand.map((card: Card) => card.clone());
        game.originalAiCards = savedState.originalAiCards
          ? restoreCards(savedState.originalAiCards, 'originalAiCards')
          : game.aiHand.map((card: Card) => card.clone());

        game.currentTurn = savedState.currentTurn || 'player';
        game.playerScore = savedState.playerScore || 5;
        game.aiScore = savedState.aiScore || 5;
        game.gameStatus = savedState.gameStatus || 'playing';
        game.winner = savedState.winner || null;
        game.suddenDeathRound = savedState.suddenDeathRound || 0;
        game.boardElements = Array.isArray(savedState.boardElements)
          ? savedState.boardElements
          : Array(9).fill(null);
        game.cardExchange = savedState.cardExchange || null;

        if (game.currentTurn !== 'player') {
          await sendLogToTelegram('❌ Попытка хода игрока, когда currentTurn !== player', {
            currentTurn: game.currentTurn,
            gameStatus: game.gameStatus,
          });
          return errorHandler({
            h,
            details: 'Сейчас не ваш ход',
            error: 'Not player\'s turn',
            code: 400,
          });
        }

        const result = game.makeMove(cardIndex, position);
        
        // Сохраняем обновленное состояние
        await createActiveGame(game.settings.userId, gameId, game.getState());

        return {
          status: 'move completed',
          gameState: game.getState(),
          moveResult: result,
        };
      } catch (error) {
        console.error('❌ Error in player move:', {
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        return errorHandler({
          h,
          details: error instanceof Error ? error.message : 'Error in player move',
          error: 'Error in player move',
          code: 400,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    },
  },

  // Выполнение хода AI
  aiMove: {
    method: 'GET' as const,
    path: '/api/game/{gameId}/ai-move',
    handler: async (request, h) => {
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;

      const { gameId } = request.params;

      try {
        const activeGame = await getActiveGameByGameId(gameId);

        if (!activeGame) {
          return errorHandler({
            h,
            details: 'Игра не найдена',
            error: 'Game not found',
            code: 404
          });
        }

        const savedState = activeGame.gameState;
        const game = new Game(savedState.settings || {}, savedState.rules || {});

        // Восстанавливаем состояние
        game.board = restoreCards(savedState.board, 'board');
        game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
        game.aiHand = restoreCards(savedState.aiHand, 'aiHand');
        game.originalPlayerCards = savedState.originalPlayerCards
          ? restoreCards(savedState.originalPlayerCards, 'originalPlayerCards')
          : game.playerHand.map((card: Card) => card.clone());
        game.originalAiCards = savedState.originalAiCards
          ? restoreCards(savedState.originalAiCards, 'originalAiCards')
          : game.aiHand.map((card: Card) => card.clone());

        game.currentTurn = savedState.currentTurn || 'player';
        game.playerScore = savedState.playerScore || 5;
        game.aiScore = savedState.aiScore || 5;
        game.gameStatus = savedState.gameStatus || 'playing';
        game.winner = savedState.winner || null;
        game.suddenDeathRound = savedState.suddenDeathRound || 0;
        game.boardElements = Array.isArray(savedState.boardElements)
          ? savedState.boardElements
          : Array(9).fill(null);
        game.cardExchange = savedState.cardExchange || null;

        if (game.currentTurn !== 'ai') {
          return h.response({
            error: 'Not AI\'s turn',
            details: {
              currentTurn: game.currentTurn,
            },
          }).code(400);
        }

        if (!game.aiHand || game.aiHand.length === 0) {
          await sendLogToTelegram('❌ Рука AI пуста', game.aiHand);
          return errorHandler({
            h,
            details: 'AI has no cards',
            error: 'Game state error',
            code: 400,
          });
        }

        try {
          const result = game.makeAIMove();
          await createActiveGame(game.settings.userId, gameId, game.getState());

          return {
            status: 'move completed',
            gameState: game.getState(),
            moveResult: result,
          };
        } catch (error) {
          await sendLogToTelegram('❌ Ошибка при выполнении хода AI', {
            error: error instanceof Error ? error.message : 'Unknown error',
            gameState: game.getState(),
          });
          throw error;
        }
      } catch (error) {
        console.error('❌ Error in AI move:', error);
        return errorHandler({
          h,
          details: error instanceof Error ? error.message : 'Error in AI move',
          error: 'Error in AI move',
          code: 400,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    },
  },

  // Получение доступных карт AI для обмена
  getAvailableCards: {
    method: 'GET' as const,
    path: '/api/game/{gameId}/available-cards',
    handler: async (request, h) => {
      const { gameId } = request.params;
      
      const activeGame = await getActiveGameByGameId(gameId);

      if (!activeGame) {
        return errorHandler({
          h,
          details: 'Игра не найдена',
          error: 'Game not found',
          code: 404
        });
      }

      const savedState = activeGame.gameState;
      const game = new Game(savedState.settings || {}, savedState.rules || {});

      // Восстанавливаем состояние
      game.board = restoreCards(savedState.board, 'board');
      game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
      game.aiHand = restoreCards(savedState.aiHand, 'aiHand');
      game.originalPlayerCards = savedState.originalPlayerCards
        ? restoreCards(savedState.originalPlayerCards, 'originalPlayerCards')
        : game.playerHand.map((card: Card) => card.clone());
      game.originalAiCards = savedState.originalAiCards
        ? restoreCards(savedState.originalAiCards, 'originalAiCards')
        : game.aiHand.map((card: Card) => card.clone());

      game.currentTurn = savedState.currentTurn || 'player';
      game.playerScore = savedState.playerScore || 5;
      game.aiScore = savedState.aiScore || 5;
      game.gameStatus = savedState.gameStatus || 'playing';
      game.winner = savedState.winner || null;
      game.suddenDeathRound = savedState.suddenDeathRound || 0;
      game.boardElements = Array.isArray(savedState.boardElements)
        ? savedState.boardElements
        : Array(9).fill(null);
      game.cardExchange = savedState.cardExchange || null;

      if (game.gameStatus !== 'finished' || game.winner !== 'player' || game.cardExchange) {
        return h.response({
          error: 'Cards are only available for winner player before exchange',
          details: {
            gameStatus: game.gameStatus,
            winner: game.winner,
            exchangePerformed: !!game.cardExchange,
          },
        }).code(400);
      }

      return {
        status: 'success',
        cards: game.originalAiCards.map((card: Card) => card.toClientObject(false)),
      };
    },
  },

  // Выполнение обмена картами
  exchangeCard: {
    method: 'POST' as const,
    path: '/api/game/{gameId}/exchange-card',
    handler: async (request, h) => {
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;

      const { gameId } = request.params;
      const { cardId } = request.payload as ExchangeCardPayload || {};

      const activeGame = await getActiveGameByGameId(gameId);

      if (!activeGame) {
        return errorHandler({
          h,
          details: 'Игра не найдена',
          error: 'Game not found',
          code: 404
        });
      }

      const savedState = activeGame.gameState;
      const game = new Game(savedState.settings || {}, savedState.rules || {});

      // Восстанавливаем состояние
      game.board = restoreCards(savedState.board, 'board');
      game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
      game.aiHand = restoreCards(savedState.aiHand, 'aiHand');
      game.originalPlayerCards = savedState.originalPlayerCards
        ? restoreCards(savedState.originalPlayerCards, 'originalPlayerCards')
        : game.playerHand.map((card: Card) => card.clone());
      game.originalAiCards = savedState.originalAiCards
        ? restoreCards(savedState.originalAiCards, 'originalAiCards')
        : game.aiHand.map((card: Card) => card.clone());

      game.currentTurn = savedState.currentTurn || 'player';
      game.playerScore = savedState.playerScore || 5;
      game.aiScore = savedState.aiScore || 5;
      game.gameStatus = savedState.gameStatus || 'playing';
      game.winner = savedState.winner || null;
      game.suddenDeathRound = savedState.suddenDeathRound || 0;
      game.boardElements = Array.isArray(savedState.boardElements)
        ? savedState.boardElements
        : Array(9).fill(null);
      game.cardExchange = savedState.cardExchange || null;

      if (game.gameStatus !== 'finished' || game.winner === 'draw') {
        return errorHandler({
          h,
          details: `Обмен картами доступен только после завершения игры с определенным победителем. Статус игры: ${game.gameStatus}, победитель: ${game.winner}`,
          error: 'Ошибка обмена картами',
          code: 400,
        });
      }

      if (game.cardExchange) {
        // Проверяем наличие карты в существующем обмене
        if (!game.cardExchange.takenCard) {
          return errorHandler({
            h, details: 'Карта обмена отсутствует в сохраненном состоянии', error: 'Ошибка состояния обмена', code: 500,
          });
        }

        // Если обмен уже был выполнен, возвращаем результат последнего обмена
        return {
          status: 'success', exchange: {
            type: game.cardExchange.type,
            card: game.cardExchange.takenCard.toClientObject(false),
            message: game.cardExchange.message,
            gameId: gameId,
            isRepeated: true,
          },
        };
      }

      try {
        let exchangeResult;

        if (game.winner === 'player') {
          if (!cardId) {
            return errorHandler({
              h,
              details: 'Пожалуйста, укажите какую карту вы хотите забрать у противника',
              error: 'Не указан ID карты для обмена',
              code: 400,
            });
          }

          // Проверяем наличие карт AI
          if (!game.originalAiCards || !Array.isArray(game.originalAiCards)) {
            console.error('❌ Ошибка originalAiCards:', {
              originalAiCards: game.originalAiCards,
              isArray: Array.isArray(game.originalAiCards),
              type: typeof game.originalAiCards,
            });
            return errorHandler({
              h, details: 'Карты противника недоступны', error: 'Ошибка состояния игры', code: 500,
            });
          }

          console.log('🔍 Проверка карт AI перед обменом:', {
            requestedCardId: cardId, availableCards: game.originalAiCards.map((c: Card | null) => ({
              id: c?.id, name: c?.name, isNull: c === null,
            })),
          });

          // Создаем новую колоду для сравнения
          const deck = Card.createDeck();
          const deckCard = deck.find(c => c.id === cardId);

          if (!deckCard) {
            console.error('❌ Карта не найдена в колоде:', {
              requestedCardId: cardId, availableCardIds: deck.map(c => c.id),
            });
            return errorHandler({
              h, details: `Карта с ID ${cardId} не найдена в колоде`, error: 'Неверный ID карты', code: 400,
            });
          }

          // Проверяем наличие карты в оригинальных картах AI
          const selectedCard = game.originalAiCards.find((card: Card | null) => {
            if (!card) {
              console.log('⚠️ Found null card in originalAiCards');
              return false;
            }
            const isMatch = card.id === cardId;
            console.log(`🔍 Сравниваем карту ${card.id} с запрошенной ${cardId}: ${isMatch}`);
            return isMatch;
          });

          if (!selectedCard) {
            return errorHandler({
              h,
              details: `Выбранная карта (${cardId}) недоступна в руке противника`,
              error: 'Неверный ID карты',
              code: 400,
            });
          }

          // Используем карту из колоды для клонирования
          const clonedCard = deckCard.clone();
          if (!clonedCard) {
            return errorHandler({
              h, details: 'Не удалось клонировать карту', error: 'Ошибка клонирования карты', code: 500,
            });
          }

          // Копируем необходимые свойства из выбранной карты
          clonedCard.owner = selectedCard.owner;
          clonedCard.position = selectedCard.position;

          exchangeResult = {
            type: 'player_win', takenCard: clonedCard, message: `Вы забрали карту ${selectedCard.name}!`,
          };
        } else {
          if (!game.getCardExchange || typeof game.getCardExchange !== 'function') {
            return errorHandler({
              h, details: 'Метод обмена картами недоступен', error: 'Ошибка состояния игры', code: 500,
            });
          }

          exchangeResult = game.getCardExchange();
          // Проверяем результат обмена
          if (!exchangeResult || !exchangeResult.takenCard) {
            return errorHandler({
              h, details: 'Invalid exchange result', error: 'Failed to perform card exchange', code: 500,
            });
          }
        }

        if (!exchangeResult) {
          return errorHandler({
            h, details: 'Не удалось выполнить обмен картами', error: 'Результат обмена не определен', code: 400,
          });
        }

        game.cardExchange = exchangeResult;

        try {
          // Обновляем карты в базе данных и статистику
          const isWin = game.winner === 'player';
          const isDraw = game.winner === 'draw';
          const wonCards: string[] = isWin ? [exchangeResult.takenCard.id] : [];
          const lostCards: string[] = !isWin && !isDraw ? [exchangeResult.takenCard.id] : [];

          // Обновляем статистику
          await updateUserStats(game.settings.userId, isWin, isDraw, wonCards, lostCards);

          // Обновляем карты
          if (isWin) {
            // Игрок выиграл - добавляем ему карту AI
            await addCardToPlayer(game.settings.userId, exchangeResult.takenCard.id);
          } else if (!isDraw) {
            // AI выиграл - удаляем карту у игрока
            await deletePlayerCard(game.settings.userId, exchangeResult.takenCard.id);
          }

          // Удаляем игру из базы данных
          await deleteActiveGame(gameId);
        } catch (error) {
          console.error('Error updating game data:', error);
          return errorHandler({
            h, details: 'Ошибка при обновлении данных игры', error, code: 500,
          });
        }

        return {
          status: 'success', exchange: {
            type: exchangeResult.type,
            card: exchangeResult.takenCard.toClientObject(false),
            message: exchangeResult.message,
            gameId: gameId,
          },
        };
      } catch (error) {
        console.error('Error in card exchange:', error);
        return errorHandler({
          h, details: 'Ошибка при обмене картами', error, code: 500,
        });
      }
    },
  },

  // Обновление статистики игры
  updateGameStats: {
    method: 'POST' as const, path: '/api/game/{gameId}/stats', handler: async (request, h) => {
      // Проверка на техническое обслуживание
      if (MAINTENANCE_MODE) {
        return errorHandler({
          h,
          details: 'Сервер временно недоступен. Проводятся технические работы.',
          error: 'Maintenance',
          code: 503
        });
      }

      const { gameId } = request.params;
      const { statsId, isWin, isDraw, wonCards = [], lostCards = [] } = request.payload as UpdateGameStatsPayload;

      if (!statsId) {
        return h.response({
          error: 'Stats ID is required', details: {
            message: 'Please provide userId in the request payload',
          },
        }).code(400);
      }

      try {
        // Обновляем статистику
        // @ts-ignore
        const stats = await updateUserStats(statsId, isWin, isDraw, wonCards, lostCards);

        // Удаляем игру из базы данных
        try {
          await deleteActiveGame(gameId);
        } catch (error) {
          console.error('Error deleting active game:', error);
          // Продолжаем выполнение, даже если удаление не удалось
        }

        return {
          status: 'success', stats,
        };
      } catch (error) {
        console.error('Error updating game stats:', error);
        return errorHandler({
          h, details: 'Error updating game stats', error, code: 500,
        });
      }
    },
  },

  // Удаление игры
  deleteGame: {
    method: 'DELETE' as const, path: '/api/game/{gameId}', handler: async (request, h) => {
      // Проверка на техническое обслуживание
      if (MAINTENANCE_MODE) {
        return errorHandler({
          h,
          details: 'Сервер временно недоступен. Проводятся технические работы.',
          error: 'Maintenance',
          code: 503
        });
      }

      const { gameId } = request.params;

      try {
        // Удаляем игру из базы данных
        await deleteActiveGame(gameId);

        return {
          status: 'success',
          message: 'Игра успешно удалена',
          gameId
        };
      } catch (error) {
        console.error('Error deleting game:', error);
        return errorHandler({
          h,
          details: 'Ошибка при удалении игры',
          error,
          code: 500
        });
      }
    }
  },
};
