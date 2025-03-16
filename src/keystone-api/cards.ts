import { Card } from '../game/core/card.js';
import { client } from './index.js';
import { GET_USER_CARDS } from '../graphql/user.js';
import { restoreUserCards } from './user.js';

export { restoreUserCards };

export async function getPlayerCards(telegramId: string) {
  try {
    // Получаем карты из базы данных
    const data = await client.request<{ playerCards: { cardId: string }[] }>(GET_USER_CARDS, {
      telegram_id: telegramId.toString()
    });

    if (!data.playerCards || data.playerCards.length === 0) {
      console.log('No cards found for user:', telegramId);
      return [];
    }

    // Получаем полную колоду карт
    const fullDeck = Card.createDeck();

    // Сопоставляем ID карт с полной информацией о картах
    const playerCards = data.playerCards.map(playerCard => {
      const cardInfo = fullDeck.find(card => card.id === playerCard.cardId);

      if (cardInfo) {
        return {
          ...playerCard,
          cardInfo: cardInfo.toClientObject(false)
        };
      }

      return playerCard;
    });

    return playerCards;
  } catch (error) {
    console.error('❌: Error getting player cards:', error);
    return [];
  }
}