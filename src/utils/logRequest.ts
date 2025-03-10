import { sendLogToTelegram } from './error.js';

// Map для отслеживания количества запросов
const requestCounts = new Map();

// Set для хранения несуществующих игр
const nonExistentGames = new Set();

/**
 * Логирует запросы и отслеживает подозрительную активность
 * @param gameId - ID игры
 * @param telegramData - Данные телеграм
 * @param request - Объект запроса
 * @returns true если запрос нужно заблокировать
 */
export async function logRequest(gameId: string, telegramData: string, request: any): Promise<boolean> {
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

export { nonExistentGames }; 