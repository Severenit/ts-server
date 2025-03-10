import { Card } from '../game/core/card.js';
import { PlayerCard } from '../types/game.js';
import { sendLogToTelegram } from './error.js';

export function restoreCards(cards: PlayerCard[], boardName: string) {
  console.log('cards', cards);
  if (!cards) {
    sendLogToTelegram('Массив карт пустой или не определен');
    return [];
  }

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