import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN не найден в .env!");
} else {
    console.log("BOT_TOKEN найден в .env и равен он %s!", BOT_TOKEN);
}

const bot = new TelegramBot(BOT_TOKEN);

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  console.log(`Сообщение от ${chatId}: ${text}`);
  await bot.sendMessage(chatId, `Вы написали: ${text}`);
});

export default bot;