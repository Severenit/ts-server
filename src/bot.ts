import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { generateInitData } from './utils/generateInitData.js';

dotenv.config();

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
const WEBAPP_URL = process.env.WEBAPP_URL as string || 'https://triple-triad-tg-game.netlify.app/';

if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN не найден в .env!");
} else {
  console.log("BOT_TOKEN найден в .env!");
}

const bot = new TelegramBot(BOT_TOKEN);


// bot.on("message", async (msg) => {
//   const chatId = msg.chat.id;
//   const text = msg.text;

//   console.log(`Сообщение от ${chatId}: ${text}`);
//   await bot.sendMessage(chatId, `Вы написали: ${text}`);
// });

bot.onText(/\/start/, async (msg) => {
  const initData = generateInitData(msg.from!);
  // Преобразуем user в строку (JSON) и кодируем
  const encodedUser = encodeURIComponent(JSON.stringify(initData.user));
  // Формируем query string
  const params = new URLSearchParams({
    query_id: initData.query_id,
    auth_date: String(initData.auth_date),
    user: encodedUser,
    signature: initData.signature,
    hash: initData.hash
  }).toString();

  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, 'Добро пожаловать в Triple Triad! Начнем же игру!');
});

bot.onText(/\/btn/, async (msg) => {
  const initData = generateInitData(msg.from!);
  // Преобразуем user в строку (JSON) и кодируем
  const encodedUser = encodeURIComponent(JSON.stringify(initData.user));
  // Формируем query string
  const params = new URLSearchParams({
    query_id: initData.query_id,
    auth_date: String(initData.auth_date),
    user: encodedUser,
    signature: initData.signature,
    hash: initData.hash
  }).toString();
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Добро пожаловать в Triple Triad! Начнем игру!', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Открыть игру', web_app: { url: `${WEBAPP_URL}?${params}` } },
        ]
      ],
      resize_keyboard: true,
    }
  })
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Нужно написать /start');
});

bot.onText(/\/notify/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Вы хотите включить уведомления?', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Включить', callback_data: 'notify_on' },
          { text: 'Отключить', callback_data: 'notify_off' }
        ]
      ]
    }
  });
});

bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  if (!callbackQuery.message) return;
  const chatId = callbackQuery.message.chat.id;

  if (data === 'notify_on') {
    await bot.sendMessage(chatId, 'Уведомления включены.');
  } else if (data === 'notify_off') {
    await bot.sendMessage(chatId, 'Уведомления отключены.');
  }

  await bot.answerCallbackQuery(callbackQuery.id);
});

export default bot;