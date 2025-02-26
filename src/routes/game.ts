import { ServerRoute } from '@hapi/hapi';

import { Game } from '../game/core/game.js';
// import { Card } from '../game/core/card.js';
import { 
  createActiveGame, 
  deleteActiveGame, 
  getActiveGameByGameId, 
  updateUserStats 
} from '../keystone-api/game.js';
import { errorHandler } from '../utils/error.js';
import { GameState, PlayerCard } from '../types/game.js';
import { Card } from '../game/core/card.js';
import { addCardToPlayer, deletePlayerCard } from '../keystone-api/user.js';

// Вспомогательная функция для получения карт по их ID
// function getCardsByIds(cardIds) {
//     const deck = Card.createDeck();
//     return cardIds
//         .map(id => {
//             const card = deck.find(c => c.id === id);
//             return card ? card.clone() : null;
//         })
//         .filter(card => card !== null);
// }
//
// Вспомогательная функция для восстановления объектов карт
function restoreCards(cards: PlayerCard[]) {
  if (!cards) return [];
  const deck = Card.createDeck();
  return cards.map(cardData => {
    if (!cardData) return null;

    const card = deck.find(c => c.id === cardData.id);

    if (!card) return null;

    const restoredCard = card.clone();
    restoredCard.owner = cardData.owner;
    // @ts-expect-error
    restoredCard.position = cardData.position;

    return restoredCard;
  });
}

// Map для хранения состояний игр
const gameStates = new Map();

interface GamePayload {
  level: number;
  settings: {
    userId: string;
    playerCards?: Array<{ cardInfo: { id: string } }>;
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
  // Создание новой игры
  createGame: {
    method: 'POST' as const,
    path: '/api/game/new',
    handler: async (request, h) => {
      try {
        const gameId = Date.now().toString();
        const { settings, level } = request.payload as GamePayload;
        console.log('L', level);
        // Проверяем наличие userId в настройках
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

        const game = new Game(
          gameSettings,
          rules,
        );

        // Получаем ID карт игрока
        let playerCardIds: string[] = [];

        if (settings?.playerCards && Array.isArray(settings.playerCards)) {
          playerCardIds = settings.playerCards.map(card => card.cardInfo.id);
        }

        if (playerCardIds.length !== 5) {
          throw new Error(`Ожидалось 5 карт игрока, но получено ${playerCardIds.length}`);
        }

        const gameState = game.initializeGame(playerCardIds) as GameState;
        // Сохраняем состояние игры в памяти
        gameStates.set(gameId, game);

        // Создаем запись об игре в базе данных
        const activeGame = await createActiveGame(
          settings.userId,
          gameId,
          gameState,
          true, // Принудительное создание новой игры
        );

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
      const { gameId } = request.params;

      try {
        // Сначала проверяем локальное состояние
        let game = gameStates.get(gameId);

        if (!game) {
          // Если локального состояния нет, пытаемся получить из базы данных
          const activeGame = await getActiveGameByGameId(gameId);

          if (!activeGame) {
            return h.response({ error: 'Game not found' }).code(404);
          }

          console.log('🎮 Found game in database, restoring state...');

          // Восстанавливаем состояние игры из сохраненного состояния
          const savedState = activeGame.gameState;

          // Создаем новую игру с сохраненными настройками
          game = new Game(
            savedState.settings || {},
            savedState.rules || {},
          );

          // Восстанавливаем карты
          game.board = restoreCards(savedState.board);
          game.playerHand = restoreCards(savedState.playerHand);
          game.aiHand = restoreCards(savedState.aiHand);
          game.originalPlayerCards = restoreCards(savedState.originalPlayerCards);
          game.originalAiCards = restoreCards(savedState.originalAiCards);

          // Восстанавливаем остальное состояние
          game.currentTurn = savedState.currentTurn;
          game.playerScore = savedState.playerScore;
          game.aiScore = savedState.aiScore;
          game.gameStatus = savedState.gameStatus;
          game.winner = savedState.winner;
          game.suddenDeathRound = savedState.suddenDeathRound || 0;
          game.boardElements = savedState.boardElements;
          game.cardExchange = savedState.cardExchange;

          // Сохраняем восстановленное состояние в память
          gameStates.set(gameId, game);

          console.log('🎮 Game state restored successfully');
        }

        return game.getState();
      } catch (error) {
        console.error('❌ Error getting game state:', error);
        return errorHandler({
          h,
          details: (error as Error).message,
          error: 'Failed to create game',
          code: 500,
        });
      }
    },
  },
  //
  // Выполнение хода игрока
  playerMove: {
      method: 'POST',
      path: '/api/game/{gameId}/player-move',
      handler: async (request, h) => {
          const { gameId } = request.params;
          const { cardIndex, position } = request.payload as PlayerMovePayload;

          try {
              let game = gameStates.get(gameId);

              if (!game) {
                  // Пытаемся восстановить игру из базы данных
                  const activeGame = await getActiveGameByGameId(gameId);
                  if (!activeGame) {
                      return h.response({ error: 'Game not found' }).code(404);
                  }

                  // Восстанавливаем состояние игры
                  const savedState = activeGame.gameState;
                  game = new Game(savedState.settings || {}, savedState.rules || {});

                  // Восстанавливаем карты
                  game.board = restoreCards(savedState.board);
                  game.playerHand = restoreCards(savedState.playerHand);
                  game.aiHand = restoreCards(savedState.aiHand);
                  game.originalPlayerCards = restoreCards(savedState.originalPlayerCards);
                  game.originalAiCards = restoreCards(savedState.originalAiCards);

                  // Восстанавливаем остальное состояние
                  game.currentTurn = savedState.currentTurn;
                  game.playerScore = savedState.playerScore;
                  game.aiScore = savedState.aiScore;
                  game.gameStatus = savedState.gameStatus;
                  game.winner = savedState.winner;
                  game.suddenDeathRound = savedState.suddenDeathRound || 0;
                  game.boardElements = savedState.boardElements;
                  game.cardExchange = savedState.cardExchange;

                  gameStates.set(gameId, game);
              }

              const result = game.makeMove(cardIndex, position);

              // Обновляем состояние в базе данных
              await createActiveGame(
                  game.settings.userId,
                  gameId,
                  game.getState()
              );

              return {
                  status: 'move completed',
                  gameState: game.getState(),
                  moveResult: result
              };
          } catch (error) {
              console.error('❌ Error in player move:', error);
            return errorHandler({
              h,
              details: (error as Error).message,
              error: 'Error in player move',
              code: 400,
            });
          }
      }
  },
  //
  // Выполнение хода AI
  aiMove: {
      method: 'GET',
      path: '/api/game/{gameId}/ai-move',
      handler: async (request, h) => {
          const { gameId } = request.params;

          try {
              let game = gameStates.get(gameId);

              if (!game) {
                  // Пытаемся восстановить игру из базы данных
                  const activeGame = await getActiveGameByGameId(gameId);

                  if (!activeGame) {
                      return h.response({ error: 'Game not found' }).code(404);
                  }

                  // Восстанавливаем состояние игры
                  const savedState = activeGame.gameState;
                  game = new Game(savedState.settings || {}, savedState.rules || {});

                  // Восстанавливаем карты с проверкой на null
                  game.board = restoreCards(savedState.board);
                  game.playerHand = restoreCards(savedState.playerHand);
                  game.aiHand = restoreCards(savedState.aiHand);

                  // Особое внимание к восстановлению оригинальных карт
                  if (savedState.originalPlayerCards && savedState.originalAiCards) {
                      game.originalPlayerCards = restoreCards(savedState.originalPlayerCards);
                      game.originalAiCards = restoreCards(savedState.originalAiCards);
                  } else {
                      // Если оригинальных карт нет, копируем из начальных рук
                      game.originalPlayerCards = game.playerHand.map((card: Card) => card.clone());
                      game.originalAiCards = game.aiHand.map((card: Card) => card.clone());
                  }

                  // Проверяем, что все карты восстановлены правильно
                  if (!game.originalPlayerCards || !game.originalAiCards ||
                      game.originalPlayerCards.some((card: Card | null) => !card) ||
                      game.originalAiCards.some((card: Card | null) => !card)) {
                      throw new Error('Failed to restore original cards');
                  }

                  // Восстанавливаем остальное состояние
                  game.currentTurn = savedState.currentTurn;
                  game.playerScore = savedState.playerScore;
                  game.aiScore = savedState.aiScore;
                  game.gameStatus = savedState.gameStatus;
                  game.winner = savedState.winner;
                  game.suddenDeathRound = savedState.suddenDeathRound || 0;
                  game.boardElements = savedState.boardElements;
                  game.cardExchange = savedState.cardExchange;

                  gameStates.set(gameId, game);
              }

              if (game.currentTurn !== 'ai') {
                  return h.response({
                      error: 'Not AI\'s turn',
                      details: {
                          currentTurn: game.currentTurn
                      }
                  }).code(400);
              }

              // Проверяем, остались ли у AI карты для хода
              if (!game.aiHand || game.aiHand.length === 0) {
                  return h.response({
                      error: 'AI has no cards left',
                      details: {
                          gameState: game.getState()
                      }
                  }).code(400);
              }

              const result = game.makeAIMove();

              // Обновляем состояние в базе данных
              await createActiveGame(
                  game.settings.userId,
                  gameId,
                  game.getState()
              );

              return {
                  status: 'move completed',
                  gameState: game.getState(),
                  moveResult: result
              };
          } catch (error) {
              console.error('❌ Error in AI move:', error);
            return errorHandler({
              h,
              details: (error as Error).message,
              error: 'Error in AI move',
              code: 400,
            });
          }
      }
  },
  //
  // Получение доступных карт AI для обмена
  getAvailableCards: {
      method: 'GET',
      path: '/api/game/{gameId}/available-cards',
      handler: (request, h) => {
          const { gameId } = request.params;
          const game = gameStates.get(gameId);

          if (!game) {
              return h.response({
                  error: 'Game not found',
                  details: {
                      gameId,
                      availableGames: Array.from(gameStates.keys())
                  }
              }).code(404);
          }

          if (game.gameStatus !== 'finished' || game.winner !== 'player' || game.cardExchange) {
              return h.response({
                  error: 'Cards are only available for winner player before exchange',
                  details: {
                      gameStatus: game.gameStatus,
                      winner: game.winner,
                      exchangePerformed: !!game.cardExchange
                  }
              }).code(400);
          }

          return {
              status: 'success',
              cards: game.originalAiCards.map((card: Card) => card.toClientObject(false))
          };
      }
  },

  // Выполнение обмена картами
  exchangeCard: {
      method: 'POST',
      path: '/api/game/{gameId}/exchange-card',
      handler: async (request, h) => {
        console.log('📌: Exchange card');
          const { gameId } = request.params;
          const { cardId } = request.payload as ExchangeCardPayload || {};
          const game = gameStates.get(gameId);

          if (!game) {
              return h.response({
                  error: 'Game not found',
                  details: {
                      gameId,
                      availableGames: Array.from(gameStates.keys())
                  }
              }).code(404);
          }

          if (game.gameStatus !== 'finished' || game.winner === 'draw') {
              return h.response({
                  error: 'Card exchange is only available for finished games with a winner',
                  details: {
                      gameStatus: game.gameStatus,
                      winner: game.winner
                  }
              }).code(400);
          }

          if (game.cardExchange) {
              // Если обмен уже был выполнен, возвращаем результат последнего обмена
              return {
                  status: 'success',
                  exchange: {
                      type: game.cardExchange.type,
                      card: game.cardExchange.takenCard.toClientObject(false),
                      message: game.cardExchange.message,
                      gameId: gameId,
                      isRepeated: true
                  }
              };
          }

          try {
              let exchangeResult;

              if (game.winner === 'player') {
                  if (!cardId) {
                      return h.response({
                          error: 'Card ID is required when player wins',
                          details: {
                              message: 'Please specify which card you want to take from AI'
                          }
                      }).code(400);
                  }

                  const selectedCard = game.originalAiCards.find((card: Card) => card.id === cardId);
                  if (!selectedCard) {
                      return h.response({
                          error: 'Invalid card ID',
                          details: {
                              message: 'Selected card is not available in AI\'s hand',
                              availableCards: game.originalAiCards.map((card: Card) => card.id)
                          }
                      }).code(400);
                  }

                  exchangeResult = {
                      type: 'player_win',
                      takenCard: selectedCard.clone(),
                      message: `Вы забрали карту ${selectedCard.name}!`
                  };
              } else {
                  exchangeResult = game.getCardExchange();
              }

              if (!exchangeResult) {
                  return h.response({
                      error: 'Failed to perform card exchange',
                      details: {
                          gameStatus: game.gameStatus,
                          winner: game.winner
                      }
                  }).code(400);
              }

              game.cardExchange = exchangeResult;

              try {
                  // Обновляем карты в базе данных и статистику
                  const isWin = game.winner === 'player';
                  const isDraw = game.winner === 'draw';
                  const wonCards: string[] = isWin ? [exchangeResult.takenCard.id] : [];
                  const lostCards: string[] = !isWin && !isDraw ? [exchangeResult.takenCard.id] : [];

                  // Обновляем статистику
                  const stats = await updateUserStats(
                      game.settings.userId,
                      isWin,
                      isDraw,
                      wonCards as any,
                      lostCards as any
                  );

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
                  // Даже если произошла ошибка при обновлении данных,
                  // мы все равно возвращаем результат обмена
              }

              return {
                  status: 'success',
                  exchange: {
                      type: exchangeResult.type,
                      card: exchangeResult.takenCard.toClientObject(false),
                      message: exchangeResult.message,
                      gameId: gameId
                  }
              };
          } catch (error) {
              return errorHandler({
                  h,
                  details: 'Error during game finalization',
                  error,
                  code: 500
              });
          }
      }
  },

  // Обновление статистики игры
  updateGameStats: {
      method: 'POST',
      path: '/api/game/{gameId}/stats',
      handler: async (request, h) => {
          const { gameId } = request.params;
          const { statsId, isWin, isDraw, wonCards = [], lostCards = [] } = request.payload as UpdateGameStatsPayload;

          if (!statsId) {
              return h.response({
                  error: 'Stats ID is required',
                  details: {
                      message: 'Please provide userId in the request payload'
                  }
              }).code(400);
          }

          try {
              // Обновляем статистику
              const stats = await updateUserStats(
                  statsId,
                  isWin,
                  isDraw,
                  wonCards as any,
                  lostCards as any
              );

              // Удаляем игру из базы данных
              try {
                  await deleteActiveGame(gameId);
              } catch (error) {
                  console.error('Error deleting active game:', error);
                  // Продолжаем выполнение, даже если удаление не удалось
              }

              return {
                  status: 'success',
                  stats
              };
          } catch (error) {
              console.error('Error updating game stats:', error);
              return errorHandler({
                  h,
                  details: 'Error updating game stats',
                  error,
                  code: 500
              });
          }
      }
  },

  // Удаление игры
  deleteGame: {
      method: 'DELETE',
      path: '/api/game/{gameId}',
      handler: async (request, h) => {
          const { gameId } = request.params;

          try {
              // Проверяем существование игры
              const game = gameStates.get(gameId);
              if (!game) {
                  const activeGame = await getActiveGameByGameId(gameId);
                  if (!activeGame) {
                      return h.response({
                          error: 'Game not found',
                          details: {
                              gameId,
                              message: 'Game does not exist in memory or database'
                          }
                      }).code(404);
                  }
              }

              // Удаляем игру из памяти
              gameStates.delete(gameId);

              // Удаляем игру из базы данных
              await deleteActiveGame(gameId);

              return {
                  status: 'success',
                  message: 'Game successfully deleted',
                  gameId
              };
          } catch (error) {
              console.error('Error deleting game:', error);
              return errorHandler({
                  h,
                  details: 'Failed to delete game',
                  error,
                  code: 500
              });
          }
      }
  }
};
