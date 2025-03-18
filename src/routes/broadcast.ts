import { Request, ResponseToolkit, ServerRoute } from '@hapi/hapi';
import { errorHandler } from '../utils/error.js';
import { versionCheck } from '../utils/versionCheck.js';
import { getAllUsers } from '../keystone-api/user.js';
import bot from '../bot.js';
import { InlineKeyboardButton, SendMessageOptions } from 'node-telegram-bot-api';

interface BroadcastPayload {
  telegram_ids?: string[];
  message: string;
  parse_mode?: 'MarkdownV2' | 'HTML';
  reply_markup?: {
    inline_keyboard: Array<Array<InlineKeyboardButton>>;
  };
}

export const broadcastRoutes: Record<string, ServerRoute> = {
  broadcast: {
    method: 'POST' as const,
    path: '/api/broadcast',
    handler: async (request: Request, h: ResponseToolkit) => {
      // Проверяем версию клиента
      const versionError = versionCheck(request, h);
      if (versionError) return versionError;

      try {
        const { telegram_ids, message, parse_mode = 'MarkdownV2', reply_markup } = request.payload as BroadcastPayload;
        const tgIds = typeof telegram_ids === 'string' ? JSON.parse(telegram_ids) : telegram_ids;
        console.log('tgIds', tgIds);
        console.log('message', message);
        console.log('telegram_ids', telegram_ids);
        if (!message) {
          return errorHandler({
            h,
            details: 'Сообщение обязательно для рассылки',
            error: 'Message is required',
            code: 400,
          });
        }

        // Проверяем корректность Markdown разметки
        if (parse_mode === 'MarkdownV2' && !isValidMarkdownV2(message)) {
          return errorHandler({
            h,
            details: 'Некорректная Markdown разметка. Используйте формат [текст](ссылка)',
            error: 'Invalid MarkdownV2 syntax',
            code: 400,
          });
        }

        let targetIds: string[] = [];

        if (telegram_ids && Array.isArray(tgIds)) {
          // Если переданы конкретные ID - используем их
          targetIds = tgIds;
        } else {
          // Если ID не переданы - получаем всех пользователей
          targetIds = await getAllUsers();
        }

        if (targetIds.length === 0) {
          return errorHandler({
            h,
            details: 'Нет пользователей для рассылки',
            error: 'No users found',
            code: 404,
          });
        }

        // Счетчики для статистики
        const stats = {
          total: targetIds.length,
          success: 0,
          failed: 0,
          errors: [] as string[],
        };

        // Рассылаем сообщения
        for (const telegram_id of targetIds) {
          try {
            // Экранируем специальные символы для MarkdownV2
            const escapedMessage = parse_mode === 'MarkdownV2' ? escapeMarkdownV2(message) : message;
            await bot.sendMessage(telegram_id, escapedMessage, { 
              parse_mode,
              ...(reply_markup && { reply_markup })
            });
            stats.success++;
          } catch (error) {
            stats.failed++;
            if (error instanceof Error) {
              stats.errors.push(`Failed to send to ${telegram_id}: ${error.message}`);
              console.error(`❌: Error sending message to ${telegram_id}:`, error);
            } else {
              stats.errors.push(`Failed to send to ${telegram_id}: Unknown error`);
              console.error(`❌: Error sending message to ${telegram_id}:`, 'Unknown error');
            }
          }
        }

        return {
          status: 'success',
          message: 'Рассылка выполнена',
          stats,
        };
      } catch (error) {
        return errorHandler({
          h,
          details: 'Ошибка при выполнении рассылки',
          error,
          code: 500,
        });
      }
    },
  },
};

// Валидация MarkdownV2
function isValidMarkdownV2(text: string): boolean {
  // Проверяем базовую структуру ссылок
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const matches = text.match(linkRegex);
  
  if (!matches) return true; // Если нет ссылок, считаем текст валидным
  
  // Проверяем каждую ссылку
  for (const match of matches) {
    const [full, text, url] = match.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
    if (!text || !url) return false;
  }
  
  return true;
}

// Экранирование специальных символов для MarkdownV2
function escapeMarkdownV2(text: string): string {
  // Разбиваем текст на части, сохраняя форматирование
  const parts = text.split(/(\*.*?\*|_.*?_|\[.*?\]\(.*?\)|`.*?`)/g);
  
  // Специальные символы, которые нужно экранировать
  const specialChars = ['.', '!', '(', ')', '[', ']', '{', '}', '>', '#', '+', '-', '=', '|', '~'];
  
  return parts.map((part, i) => {
    // Если это часть с форматированием - оставляем как есть
    if (i % 2 === 1) return part;
    
    // Экранируем специальные символы в обычном тексте
    return specialChars.reduce((acc, char) => 
      acc.replace(new RegExp('\\' + char, 'g'), '\\' + char),
      part
    );
  }).join('');
}