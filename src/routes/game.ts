import { ServerRoute } from '@hapi/hapi';

import { Game } from '../game/core/game.js';

import { createActiveGame, deleteActiveGame, getActiveGameByGameId, updateUserStats } from '../keystone-api/game.js';
import { errorHandler, sendLogToTelegram } from '../utils/error.js';
import { GameState, PlayerCard } from '../types/game.js';
import { Card } from '../game/core/card.js';
import { addCardToPlayer, deletePlayerCard } from '../keystone-api/user.js';

// Вспомогательная функция для восстановления объектов карт
function restoreCards(cards: PlayerCard[], boardName: string) {
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

// Map для хранения состояний игр
const gameStates = new Map();

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
  // Создание новой игры
  createGame: {
    method: 'POST' as const, path: '/api/game/new', handler: async (request, h) => {
      try {
        const gameId = Date.now().toString();
        const { settings: s, level } = request.payload as GamePayload;
        const settings: GamePayload['settings'] = typeof s === 'string' ? JSON.parse(s) : s;

        if (!settings?.userId) {
          throw new Error('ID пользователя обязательно для создания игры');
        }

        const gameSettings = {
          AI_PLAYER: 'BALANCED', AI_OPPONENT: 'BALANCED', ...settings,
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
        const activeGame = await createActiveGame(String(settings.userId), gameId, gameState, true, // Принудительное создание новой игры
        );

        return {
          gameId, status: 'created', gameState, activeGame: {
            id: activeGame.id, gameId: activeGame.gameId,
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
    method: 'GET' as const, path: '/api/game/{gameId}', handler: async (request, h) => {
      const { gameId } = request.params;

      try {
        // Сначала проверяем локальное состояние
        let game = gameStates.get(gameId);

        if (!game) {
          await sendLogToTelegram('🔄 Восстанавливаем игру из БД (`getGameState`)', { gameId });
          // Если локального состояния нет, пытаемся получить из базы данных
          const activeGame = await getActiveGameByGameId(gameId);

          if (!activeGame) {
            return errorHandler({
              h, details: 'Кажется мы потеряли данные об игре :(', error: {
                message: 'Game not found', details: {
                  gameId, availableGames: Array.from(gameStates.keys()),
                },
              }, code: 404,
            });
          }

          // Восстанавливаем состояние игры
          const savedState = activeGame.gameState;
          game = new Game(savedState.settings || {}, savedState.rules || {});
          // Проверяем и восстанавливаем доску
          if (!Array.isArray(savedState.board)) {
            await sendLogToTelegram('⚠️ Доска в сохраненном состоянии не является массивом', {
              board: savedState.board, type: typeof savedState.board,
            });
            game.board = Array(9).fill(null);
          } else if (savedState.board.length !== 9) {
            await sendLogToTelegram('⚠️ Некорректная длина доски', {
              length: savedState.board.length,
            });

            game.board = Array(9).fill(null);
          } else {
            // Восстанавливаем карты на доске
            const restoredBoard = restoreCards(savedState.board, 'restoredBoard');
            game.board = Array(9).fill(null);
            // Копируем только валидные карты, сохраняя null для пустых позиций
            savedState.board.forEach((card: Card | null, index: number) => {
              if (card) {
                game.board[index] = restoredBoard.find(c => c.id === card.id) || null;
              }
            });
          }

          game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
          game.aiHand = restoreCards(savedState.aiHand, 'aiHand');

          // Особое внимание к восстановлению оригинальных карт
          if (savedState.originalPlayerCards && savedState.originalAiCards) {
            game.originalPlayerCards = restoreCards(savedState.originalPlayerCards, 'originalPlayerCards');
            game.originalAiCards = restoreCards(savedState.originalAiCards, 'originalAiCards');
          } else {
            // Если оригинальных карт нет, копируем из начальных рук
            game.originalPlayerCards = game.playerHand.map((card: Card) => card.clone());
            game.originalAiCards = game.aiHand.map((card: Card) => card.clone());
          }

          // Восстанавливаем остальное состояние с значениями по умолчанию
          // await sendLogToTelegram('🔄 Восстанавливаем currentTurn', {
          //   savedTurn: savedState.currentTurn, defaultTurn: 'player',
          // });
          game.currentTurn = savedState.currentTurn || 'player';
          game.playerScore = savedState.playerScore || 5;
          game.aiScore = savedState.aiScore || 5;
          game.gameStatus = savedState.gameStatus || 'playing';
          game.winner = savedState.winner || null;
          game.suddenDeathRound = savedState.suddenDeathRound || 0;
          game.boardElements = Array.isArray(savedState.boardElements) ? savedState.boardElements : Array(9).fill(null);
          game.cardExchange = savedState.cardExchange || null;

          if (!Array.isArray(game.board) || game.board.length !== 9) {
            await sendLogToTelegram('❌ Критическая ошибка: некорректная доска после восстановления');
            return errorHandler({
              h, details: 'Invalid board state after restoration', error: 'Game state error', code: 500,
            });
          }
          // Сохраняем восстановленное состояние в память
          gameStates.set(gameId, game);
        }

        return game.getState();
      } catch (error) {
        console.error('❌ Error getting game state:', error);
        return errorHandler({
          h, details: (error as Error).message, error: 'Failed to create game', code: 500,
        });
      }
    },
  }, //
  // Выполнение хода игрока
  playerMove: {
    method: 'POST' as const, path: '/api/game/{gameId}/player-move', handler: async (request, h) => {
      const { gameId } = request.params;
      const { cardIndex, position } = request.payload as PlayerMovePayload;

      try {
        let game = gameStates.get(gameId);

        if (!game) {
          await sendLogToTelegram('🔄 Восстанавливаем игру из БД (ход игрока)', { gameId });
          try {
            // Пытаемся восстановить игру из базы данных
            const activeGame = await getActiveGameByGameId(gameId);

            if (!activeGame) {
              return errorHandler({
                h, details: 'Кажется мы потеряли данные об игре :(', error: {
                  message: 'Game not found', details: {
                    gameId, availableGames: Array.from(gameStates.keys()),
                  },
                }, code: 404,
              });
            }

            // Восстанавливаем состояние игры
            const savedState = activeGame.gameState;
            game = new Game(savedState.settings || {}, savedState.rules || {});
            // Проверяем и восстанавливаем доску
            if (!Array.isArray(savedState.board)) {
              await sendLogToTelegram('⚠️ Доска в сохраненном состоянии не является массивом', {
                board: savedState.board, type: typeof savedState.board,
              });
              game.board = Array(9).fill(null);
            } else if (savedState.board.length !== 9) {
              await sendLogToTelegram('⚠️ Некорректная длина доски', {
                length: savedState.board.length,
              });

              game.board = Array(9).fill(null);
            } else {
              // Восстанавливаем карты на доске
              const restoredBoard = restoreCards(savedState.board, 'restoredBoard');
              game.board = Array(9).fill(null);
              // Копируем только валидные карты, сохраняя null для пустых позиций
              savedState.board.forEach((card: Card | null, index: number) => {
                if (card) {
                  game.board[index] = restoredBoard.find(c => c.id === card.id) || null;
                }
              });
            }

            game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
            game.aiHand = restoreCards(savedState.aiHand, 'aiHand');

            // Особое внимание к восстановлению оригинальных карт
            if (savedState.originalPlayerCards && savedState.originalAiCards) {
              game.originalPlayerCards = restoreCards(savedState.originalPlayerCards, 'originalPlayerCards');
              game.originalAiCards = restoreCards(savedState.originalAiCards, 'originalAiCards');
            } else {
              // Если оригинальных карт нет, копируем из начальных рук
              game.originalPlayerCards = game.playerHand.map((card: Card) => card.clone());
              game.originalAiCards = game.aiHand.map((card: Card) => card.clone());
            }

            // Восстанавливаем остальное состояние
            // await sendLogToTelegram('🔄 Восстанавливаем currentTurn', {
            //   savedTurn: savedState.currentTurn, defaultTurn: 'player',
            // });
            game.currentTurn = savedState.currentTurn || 'player';
            game.playerScore = savedState.playerScore || 5;
            game.aiScore = savedState.aiScore || 5;
            game.gameStatus = savedState.gameStatus || 'playing';
            game.winner = savedState.winner || null;
            game.suddenDeathRound = savedState.suddenDeathRound || 0;
            game.boardElements = Array.isArray(savedState.boardElements) ? savedState.boardElements : Array(9).fill(null);
            game.cardExchange = savedState.cardExchange || null;

            // Проверяем состояние перед сохранением
            // const validationState = {
            //   board: {
            //     isArray: Array.isArray(game.board), length: game.board?.length, content: game.board,
            //   }, aiHand: {
            //     isArray: Array.isArray(game.aiHand),
            //     length: game.aiHand?.length,
            //     cards: game.aiHand?.map((c: Card | null) => c?.id),
            //   }, currentTurn: game.currentTurn,
            // };

            // await sendLogToTelegram('🔍 Валидация состояния игры перед сохранением', validationState);

            if (!Array.isArray(game.board) || game.board.length !== 9) {
              await sendLogToTelegram('❌ Критическая ошибка: некорректная доска после восстановления');
              return errorHandler({
                h, details: 'Invalid board state after restoration', error: 'Game state error', code: 500,
              });
            }

            // Сохраняем восстановленное состояние
            gameStates.set(gameId, game);
          } catch (error) {
            console.error('❌ Ошибка при восстановлении игры:', error);
            await sendLogToTelegram('❌ Ошибка при восстановлении игры', {
              error: error instanceof Error ? error.message : String(error),
              gameId,
              stack: error instanceof Error ? error.stack : undefined,
            });
            return errorHandler({
              h, details: 'Не удалось восстановить состояние игры', error, code: 500,
            });
          }
        }

        // Проверяем состояние перед ходом игрока
        // const gameStateBeforeMove = {
        //   board: {
        //     isArray: Array.isArray(game.board),
        //     length: game.board.length,
        //     content: game.board,
        //     nullPositions: game.board
        //       .map((cell: Card | null, index: number) => ({ pos: index, isEmpty: cell === null }))
        //       .filter((pos: { pos: number; isEmpty: boolean }) => pos.isEmpty)
        //       .map((pos: { pos: number }) => pos.pos),
        //   },
        //   playerHand: {
        //     length: game.playerHand?.length,
        //     cards: game.playerHand?.map((c: Card | null) => c?.id),
        //   },
        //   currentTurn: game.currentTurn,
        // };
        // TODO: Turn on when if we want see logs
        // await sendLogToTelegram('🎮 Состояние игры перед ходом игрока', gameStateBeforeMove);

        // Проверяем, чей сейчас ход
        if (game.currentTurn !== 'player') {
          await sendLogToTelegram('❌ Попытка хода игрока, когда currentTurn !== player', {
            currentTurn: game.currentTurn, gameStatus: game.gameStatus,
          });
          return errorHandler({
            h, details: 'Сейчас не ваш ход', error: 'Not player\'s turn', code: 400,
          });
        }

        const result = game.makeMove(cardIndex, position);
        // Обновляем состояние в базе данных
        try {
          const gameState = game.getState();
          // await sendLogToTelegram('📝 Сохраняем состояние игры после хода', {
          //     userId: game.settings.userId,
          //     gameId,
          //     board: gameState.board.map((card: Card | null) => card ? { id: card.id, name: card.name } : null),
          //     currentTurn: gameState.currentTurn,
          //     stateSize: JSON.stringify(gameState).length
          // });

          // Проверяем существование игры перед обновлением
          // const existingGame = await getActiveGameByGameId(gameId);
          //
          // if (!existingGame) {
          //     await sendLogToTelegram('⚠️ Игра не найдена в БД перед обновлением', { gameId });
          //     return errorHandler({
          //         h,
          //         details: 'Game not found in database before update',
          //         error: 'Game state error',
          //         code: 404
          //     });
          // }

          await createActiveGame(game.settings.userId, gameId, gameState);

          // await sendLogToTelegram('✅ Состояние игры успешно обновлено', {
          //     gameId,
          //     currentTurn: gameState.currentTurn
          // });

          return {
            status: 'move completed', gameState: gameState, moveResult: result,
          };
        } catch (error) {
          console.error('❌ Ошибка при обновлении состояния игры:', {
            error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });

          await sendLogToTelegram('❌ Ошибка при обновлении состояния игры', {
            error: error instanceof Error ? error.message : String(error),
            gameId,
            stack: error instanceof Error ? error.stack : undefined,
          });

          return errorHandler({
            h, details: 'Failed to update game state', error, code: 500,
          });
        }
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
  }, //
  // Выполнение хода AI
  aiMove: {
    method: 'GET' as const, path: '/api/game/{gameId}/ai-move', handler: async (request, h) => {
      const { gameId } = request.params;

      try {
        let game = gameStates.get(gameId);

        if (!game) {
          await sendLogToTelegram('🔄 Восстанавливаем игру из БД (ход AI)', { gameId });
          // Пытаемся восстановить игру из базы данных
          const activeGame = await getActiveGameByGameId(gameId);

          if (!activeGame) {
            return errorHandler({
              h, details: 'Кажется мы потеряли данные об игре :(', error: {
                message: 'Game not found', details: {
                  gameId, availableGames: Array.from(gameStates.keys()),
                },
              }, code: 404,
            });
          }

          // Восстанавливаем состояние игры
          const savedState = activeGame.gameState;
          game = new Game(savedState.settings || {}, savedState.rules || {});

          // Проверяем и восстанавливаем доску
          if (!Array.isArray(savedState.board)) {
            await sendLogToTelegram('⚠️ Доска в сохраненном состоянии не является массивом', {
              board: savedState.board, type: typeof savedState.board,
            });
            game.board = Array(9).fill(null);
          } else if (savedState.board.length !== 9) {
            await sendLogToTelegram('⚠️ Некорректная длина доски', {
              length: savedState.board.length,
            });
            game.board = Array(9).fill(null);
          } else {
            // Восстанавливаем карты на доске
            const restoredBoard = restoreCards(savedState.board, 'restoredBoard');
            game.board = Array(9).fill(null);
            // Копируем только валидные карты, сохраняя null для пустых позиций
            savedState.board.forEach((card: Card | null, index: number) => {
              if (card) {
                game.board[index] = restoredBoard.find(c => c.id === card.id) || null;
              }
            });

            // await sendLogToTelegram('✅ Восстановлена доска', {
            //     board: game.board.map((card: Card | null) => card ? { id: card.id, name: card.name } : null)
            // });
          }

          // Восстанавливаем карты с проверкой на null
          game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
          game.aiHand = restoreCards(savedState.aiHand, 'aiHand');

          // Особое внимание к восстановлению оригинальных карт
          if (savedState.originalPlayerCards && savedState.originalAiCards) {
            game.originalPlayerCards = restoreCards(savedState.originalPlayerCards, 'originalPlayerCards');
            game.originalAiCards = restoreCards(savedState.originalAiCards, 'originalAiCards');
          } else {
            // Если оригинальных карт нет, копируем из начальных рук
            game.originalPlayerCards = game.playerHand.map((card: Card) => card.clone());
            game.originalAiCards = game.aiHand.map((card: Card) => card.clone());
          }

          // Восстанавливаем остальное состояние
          await sendLogToTelegram('🔄 Восстанавливаем currentTurn', {
            savedTurn: savedState.currentTurn, defaultTurn: 'player',
          });
          game.currentTurn = savedState.currentTurn || 'player';
          game.playerScore = savedState.playerScore || 5;
          game.aiScore = savedState.aiScore || 5;
          game.gameStatus = savedState.gameStatus || 'playing';
          game.winner = savedState.winner || null;
          game.suddenDeathRound = savedState.suddenDeathRound || 0;
          game.boardElements = Array.isArray(savedState.boardElements) ? savedState.boardElements : Array(9).fill(null);
          game.cardExchange = savedState.cardExchange || null;

          // Проверяем состояние перед сохранением
          const validationState = {
            board: {
              isArray: Array.isArray(game.board), length: game.board?.length, content: game.board,
            }, aiHand: {
              isArray: Array.isArray(game.aiHand),
              length: game.aiHand?.length,
              cards: game.aiHand?.map((c: Card | null) => c?.id),
            }, currentTurn: game.currentTurn,
          };

          await sendLogToTelegram('🔍 Валидация состояния игры перед сохранением', validationState);

          if (!Array.isArray(game.board) || game.board.length !== 9) {
            await sendLogToTelegram('❌ Критическая ошибка: некорректная доска после восстановления');
            return errorHandler({
              h, details: 'Invalid board state after restoration', error: 'Game state error', code: 500,
            });
          }

          // Сохраняем восстановленное состояние
          gameStates.set(gameId, game);
        }

        if (game.currentTurn !== 'ai') {
          return h.response({
            error: 'Not AI\'s turn', details: {
              currentTurn: game.currentTurn,
            },
          }).code(400);
        }

        // Проверяем состояние перед ходом AI
        const gameStateBeforeMove = {
          board: {
            isArray: Array.isArray(game.board),
            length: game.board.length,
            content: game.board,
            nullPositions: game.board
              .map((cell: Card | null, index: number) => ({ pos: index, isEmpty: cell === null }))
              .filter((pos: { pos: number; isEmpty: boolean }) => pos.isEmpty)
              .map((pos: { pos: number }) => pos.pos),
          }, aiHand: {
            length: game.aiHand?.length, cards: game.aiHand?.map((c: Card | null) => c?.id),
          }, currentTurn: game.currentTurn,
        };
        // TODO: Turn on logging
        //await sendLogToTelegram('🎮 Подробное состояние перед ходом AI', gameStateBeforeMove);

        // if (gameStateBeforeMove.board.nullPositions.length === 0) {
        //     await sendLogToTelegram('❌ Нет доступных позиций для хода', gameStateBeforeMove);
        //     return errorHandler({
        //         h,
        //         details: 'No available positions for move',
        //         error: 'Game state error',
        //         code: 400
        //     });
        // }

        if (!game.aiHand || game.aiHand.length === 0) {
          await sendLogToTelegram('❌ Рука AI пуста', game.aiHand);
          return errorHandler({
            h, details: 'AI has no cards', error: 'Game state error', code: 400,
          });
        }

        try {
          const result = game.makeAIMove();
          // // Логируем результат хода
          // await sendLogToTelegram('✅ Ход AI выполнен', {
          //     moveResult: result,
          //     newBoardState: game.board?.map((c: Card | null) => c?.id),
          //     remainingAiCards: game.aiHand?.map((c: Card | null) => c?.id)
          // });

          // Обновляем состояние в базе данных
          await createActiveGame(game.settings.userId, gameId, game.getState());

          return {
            status: 'move completed', gameState: game.getState(), moveResult: result,
          };
        } catch (error) {
          await sendLogToTelegram('❌ Ошибка при выполнении хода AI', {
            error: error instanceof Error ? error.message : 'Unknown error', gameState: game.getState(),
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
  }, //
  // Получение доступных карт AI для обмена
  getAvailableCards: {
    method: 'GET' as const, path: '/api/game/{gameId}/available-cards', handler: (request, h) => {
      const { gameId } = request.params;
      const game = gameStates.get(gameId);

      if (!game) {
        return h.response({
          error: 'Game not found', details: {
            gameId, availableGames: Array.from(gameStates.keys()),
          },
        }).code(404);
      }

      if (game.gameStatus !== 'finished' || game.winner !== 'player' || game.cardExchange) {
        return h.response({
          error: 'Cards are only available for winner player before exchange', details: {
            gameStatus: game.gameStatus, winner: game.winner, exchangePerformed: !!game.cardExchange,
          },
        }).code(400);
      }

      return {
        status: 'success', cards: game.originalAiCards.map((card: Card) => card.toClientObject(false)),
      };
    },
  },

  // Выполнение обмена картами
  exchangeCard: {
    method: 'POST' as const, path: '/api/game/{gameId}/exchange-card', handler: async (request, h) => {
      console.log('📌: Производим обмен картами');
      // await sendLogToTelegram('📌 Начинаем процесс обмена картами');

      const { gameId } = request.params;
      const { cardId } = request.payload as ExchangeCardPayload || {};
      let game = gameStates.get(gameId);

      if (!game) {
        await sendLogToTelegram('🔄 Игра не найдена в памяти, пытаемся восстановить из БД', { gameId });
        // Пытаемся восстановить игру из базы данных
        const activeGame = await getActiveGameByGameId(gameId);
        if (!activeGame) {
          return errorHandler({
            h, details: 'Кажется мы потеряли данные об игре :(', error: {
              message: 'Game not found', details: {
                gameId, availableGames: Array.from(gameStates.keys()),
              },
            }, code: 404,
          });
        }

        // Восстанавливаем состояние игры
        const savedState = activeGame.gameState;
        game = new Game(savedState.settings || {}, savedState.rules || {});

        // Восстанавливаем карты
        console.log('🔄 Начинаем восстановление карт');
        game.board = restoreCards(savedState.board, 'board');
        game.playerHand = restoreCards(savedState.playerHand, 'playerHand');
        game.aiHand = restoreCards(savedState.aiHand, 'aiHand');

        // Особое внимание к восстановлению оригинальных карт
        if (savedState.originalPlayerCards && Array.isArray(savedState.originalPlayerCards)) {
          game.originalPlayerCards = restoreCards(savedState.originalPlayerCards, 'originalPlayerCards');
        } else {
          console.log('⚠️ originalPlayerCards не найдены, копируем из playerHand');
          game.originalPlayerCards = game.playerHand.map((card: Card) => card.clone());
        }

        if (savedState.originalAiCards && Array.isArray(savedState.originalAiCards)) {
          game.originalAiCards = restoreCards(savedState.originalAiCards, 'originalAiCards');
          await sendLogToTelegram('✅ Восстановлены оригинальные карты AI', {
            count: game.originalAiCards.length,
            cards: game.originalAiCards.map((c: Card) => ({ id: c.id, name: c.name })),
          });
        } else {
          console.log('⚠️ originalAiCards не найдены, копируем из aiHand');
          game.originalAiCards = game.aiHand.map((card: Card) => card.clone());
          await sendLogToTelegram('⚠️ Использованы карты из текущей руки AI как оригинальные', {
            count: game.originalAiCards.length,
            cards: game.originalAiCards.map((c: Card) => ({ id: c.id, name: c.name })),
          });
        }

        // Проверяем восстановление карт
        const cardsState = {
          board: {
            length: game.board?.length, cards: game.board?.map((c: Card | null) => c?.id),
          }, playerHand: {
            length: game.playerHand?.length, cards: game.playerHand?.map((c: Card | null) => c?.id),
          }, aiHand: {
            length: game.aiHand?.length, cards: game.aiHand?.map((c: Card | null) => c?.id),
          }, originalPlayerCards: {
            length: game.originalPlayerCards?.length, cards: game.originalPlayerCards?.map((c: Card | null) => c?.id),
          }, originalAiCards: {
            length: game.originalAiCards?.length, cards: game.originalAiCards?.map((c: Card | null) => c?.id),
          },
        };

        console.log('🔍 Детальная проверка восстановленных карт:', cardsState);
        // await sendLogToTelegram('🔍 Состояние карт после восстановления', cardsState);

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
      }

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
          await sendLogToTelegram('👤 Победил игрок, проверяем возможность обмена карт', {
            requestedCardId: cardId, availableCards: game.originalAiCards.map((c: Card | null) => ({
              id: c?.id, name: c?.name, isNull: c === null,
            })),
          });

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
      const { gameId } = request.params;

      try {
        // Проверяем существование игры
        const game = gameStates.get(gameId);
        if (!game) {
          const activeGame = await getActiveGameByGameId(gameId);
          if (!activeGame) {
            return h.response({
              error: 'Game not found', details: {
                gameId, message: 'Game does not exist in memory or database',
              },
            }).code(404);
          }
        }

        // Удаляем игру из памяти
        gameStates.delete(gameId);

        // Удаляем игру из базы данных
        await deleteActiveGame(gameId);

        return {
          status: 'success', message: 'Game successfully deleted', gameId,
        };
      } catch (error) {
        console.error('Error deleting game:', error);
        return errorHandler({
          h, details: 'Failed to delete game', error, code: 500,
        });
      }
    },
  },
};
