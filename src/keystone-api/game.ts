import {
  CHECK_ACTIVE_GAME,
  CREATE_ACTIVE_GAME,
  DELETE_ACTIVE_GAME,
  GET_ACTIVE_GAME, GET_USER_STATS,
  UPDATE_ACTIVE_GAME, UPDATE_USER_STATS,
} from '../graphql/game.js';
import { client } from './index.js';
import { ActiveGame, GameState } from '../types/game.js';

/**
 * Получение активной игры по её ID
 * @param {string} gameId - ID игры
 * @returns {Promise<Object|null>} Информация об игре или null, если игра не найдена
 */
export async function getActiveGameByGameId(gameId: string) {
  try {
    console.log('🎮 Запрашиваем игру из базы данных...');
    console.log('ID игры:', gameId);

    const data = await client.request<{ activeGame: any }>(GET_ACTIVE_GAME, { gameId });

    if (!data.activeGame) {
      console.log('🎮 Нет активной игры с ID:', gameId);
      return null;
    }

    console.log('🎮 Найдена активная игра:', data.activeGame);
    return data.activeGame;
  } catch (error) {
    console.error('❌ Ошибка получения активной игры:', error);
    throw error;
  }
}

/**
 * Создание новой активной игры в базе данных
 * @param {string} userId - ID пользователя
 * @param {string} gameId - ID игры
 * @param {Object} gameState - Начальное состояние игры
 * @returns {Promise<Object>} Результат создания игры
 */
export async function createNewActiveGame(userId: string, gameId: string, gameState: any) {
  try {
    console.log('🎮 Создаем новую активную игру в базе данных...');

    const createData = await client.request<{ createActiveGame: ActiveGame }>(CREATE_ACTIVE_GAME, {
      userId,
      gameId,
      initialState: {
        ...gameState,
        gameId
      }
    });

    return createData.createActiveGame;
  } catch (error) {
    console.error('❌ Ошибка создания активной игры:', error);
    throw error;
  }
}

/**
 * Обновление существующей активной игры в базе данных
 * @param {string} gameId - ID игры
 * @param {Object} gameState - Новое состояние игры
 * @returns {Promise<Object>} Результат обновления игры
 */
export async function updateActiveGame(gameId: string, gameState: GameState,) {
  try {
    console.log('🎮 Обновляем активную игру в базе данных...');

    const updateData = await client.request<{ updateActiveGame: ActiveGame }>(UPDATE_ACTIVE_GAME, {
      gameId,
      initialState: {
        ...gameState,
        gameId
      }
    });

    return updateData.updateActiveGame;
  } catch (error) {
    console.error('❌ Ошибка обновления активной игры:', error);
    throw error;
  }
}

/**
 * Создание или обновление активной игры в базе данных
 * @param {string} userId - ID пользователя
 * @param {string} gameId - ID игры
 * @param {Object} gameState - Состояние игры
 * @param {boolean} [forceCreate=false] - Принудительное создание новой игры
 * @returns {Promise<Object>} Результат создания/обновления игры
 */
export async function createActiveGame(userId: string, gameId: string, gameState: any, forceCreate = false) {
  try {
    if (forceCreate) {
      return await createNewActiveGame(userId, gameId, gameState);
    }

    // Проверяем существование игры
    const checkResult = await client.request<{ activeGame: ActiveGame }>(CHECK_ACTIVE_GAME, { gameId });

    if (checkResult.activeGame) {
      return await updateActiveGame(gameId, gameState);
    } else {
      return await createNewActiveGame(userId, gameId, gameState);
    }
  } catch (error) {
    console.error('❌ Error in createActiveGame:', error);
    throw error;
  }
}

/**
 * Удаление активной игры из базы данных
 * @param {string} gameId - ID игры для удаления
 * @returns {Promise<Object>} Результат удаления игры
 */
export async function deleteActiveGame(gameId: string) {
  try {
    console.log('🎮 Deleting active game from database...');
    console.log('Game ID:', gameId);

    const data = await client.request<{ deleteActiveGame: { id: string; gameId: string; } }>(DELETE_ACTIVE_GAME, { gameId });

    console.log('🎮 Active game deleted:', data);
    return data.deleteActiveGame;
  } catch (error) {
    console.error('❌ Error deleting active game:', error);
    throw error;
  }
}

/**
 * Обновление статистики игрока
 * @param {string} userId - ID пользователя
 * @param {boolean} isWin - Победил ли игрок
 * @param {boolean} isDraw - Ничья ли
 * @param {string[]} wonCards - ID выигранных карт
 * @param {string[]} lostCards - ID потерянных карт
 * @returns {Promise<Object>} Обновленная статистика
 */
export async function updateUserStats(statsId: string, isWin: boolean, isDraw: boolean, wonCards: string[] = [], lostCards: string[] = []) {
  try {
    console.log('🎮 Updating user stats...');
    const stats = await client.request<{ userStats: any }>(GET_USER_STATS, { statsId });

    if (!stats.userStats) {
      return;
    }

    // Преобразуем булевы значения в числа для инкремента
    const wins = isWin ? 1 : 0;
    const draws = isDraw ? 1 : 0;
    const losses = !isWin && !isDraw ? 1 : 0;

    const cardsWin =  Array.isArray(stats.userStats.cards_won) ? [...stats.userStats.cards_won, ...wonCards] : [...wonCards];
    const cardsLost =  Array.isArray(stats.userStats.cards_lost) ? [...stats.userStats.cards_lost, ...lostCards] : [...lostCards];

    const data = await client.request<{ updateUserStats: any }>(UPDATE_USER_STATS, {
      statsId,
      totalGames:  Number(stats.userStats.total_games) + 1,
      wins: Number(stats.userStats.wins) + wins,
      draws: Number(stats.userStats.draws) + draws,
      losses: Number(stats.userStats.losses) + losses,
      wonCards: cardsWin,
      lostCards: cardsLost,
    });

    console.log('🎮 User stats updated:', data.updateUserStats);
    return data.updateUserStats;
  } catch (error) {
    console.error('❌ Error updating user stats:', error);
    throw error;
  }
}
