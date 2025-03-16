// Получение или создание игрока
import { client } from './index.js';
import { ADD_CARD_TO_USER, CREATE_USER, DELETE_PLAYER_CARD, GET_PLAYER_CARD, GET_USER, GET_ALL_USERS } from '../graphql/user.js';
import bot from '../bot.js';
import { Card } from '../game/core/card.js';
import { User } from '../types/user.js';

interface UserResponse {
  user: User | null;
}

interface GetOrCreatePlayerProps {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  hash?: string;
  is_bot?: boolean;
}

export async function getOrCreatePlayer(telegramData: GetOrCreatePlayerProps) {
  try {
    // Сначала пытаемся найти существующего пользователя
    const existingUserData = await client.request<UserResponse>(GET_USER, {
      telegram_id: telegramData.id.toString(),
    });

    if (existingUserData.user) {
      const { playerCards, ...userData } = existingUserData.user;

      return {
        status: 'success',
        player: {
          ...userData,
          isNewPlayer: false,
          cards: playerCards.map(card => card.cardId)
        }
      };
    }

    // Если пользователь не найден, создаем нового
    const defaultHash = 'tripal_triad_' + Date.now();

    const photoUrl = telegramData.first_name && telegramData.last_name ? `https://avatar.iran.liara.run/username?username=${telegramData.first_name}+${telegramData.last_name}` : 'https://avatar.iran.liara.run/public';

    const userData = {
      telegram_id: telegramData.id.toString(),
      username: telegramData.username || telegramData.id.toString(),
      telegram_hash: telegramData.hash || defaultHash,
      first_name: telegramData.first_name || '',
      last_name: telegramData.last_name || '',
      photo_url: telegramData.photo_url || photoUrl,
      stats: {
        create: {
          total_games: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          cards_won: 0,
          cards_lost: 0
        }
      }
    };
    console.log('🌐: userData:', userData);
    try {
      const newUserData = await client.request<{ createUser: User }>(CREATE_USER, { userData });
      console.log('🌐: newUserData:', newUserData);

      const newUser = newUserData.createUser;

      // Добавляем стартовые карты для нового пользователя
      console.log('🌐: Adding starter cards for new user:', newUser.id);
      const starterCards = Card.getStarterCards();
      console.log('🌐: Selected starter cards:', starterCards);

      try {
        const addCardPromises = starterCards.map(card =>
          addCardToPlayer(newUser.id, card.id)
            .then(addedCard => {
              console.log(`🌐: Successfully added card ${card.id} for new user`);
              return addedCard;
            })
            .catch(error => {
              console.error(`❌: Failed to add card ${card.id}:`, error);
              throw error; // Пробрасываем ошибку дальше
            })
        );

        const addedCards = await Promise.all(addCardPromises);
        console.log('🌐: Successfully added all starter cards:', addedCards);

        if (addedCards.length !== 10) {
          throw new Error(`❌: Expected 10 cards to be added, but got ${addedCards.length}`);
        }

        // Получаем обновленные данные пользователя с ID карт
        const userWithCards = await client.request<UserResponse>(GET_USER, {
          telegram_id: newUser.telegram_id
        });

        if (!userWithCards.user) {
          throw new Error('❌: Failed to get user with cards');
        }

        try {
          await bot.sendMessage(newUser.telegram_id, '🎉 Поздравляем! Вы успешно зарегистрировались в Triple Triad!');
        } catch (error) {
          console.error('❌: Error sending welcome TG message:', error);
        }

        const { playerCards, ...userData } = userWithCards.user;
        const result = {
          ...userData,
          isNewPlayer: true,
          cards: addedCards
        };

        return {
          status: 'created',
          player: result
        };
      } catch (error) {
        console.error('❌: Error adding starter cards:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌: Error creating user:', error);
      throw error; // Пробрасываем ошибку дальше
    }
  } catch (error) {
    console.error('❌: Error in getOrCreatePlayer:', error);
    throw error;
  }
}

export async function addCardToPlayer(playerId: string, cardId: string) {
  try {
    console.log(`🌐: Attempting to add card ${cardId} to player ${playerId}`);
    const data = await client.request<{ createPlayerCard: { cardId: string } }>(ADD_CARD_TO_USER, {
      userId: playerId,
      cardId: cardId.toString()
    });

    if (!data || !data.createPlayerCard || !data.createPlayerCard.cardId) {
      throw new Error(`❌: Failed to add card ${cardId}: Invalid response from server`);
    }

    console.log(`🌐: Successfully added card ${cardId} to player ${playerId}`);
    return data.createPlayerCard.cardId;
  } catch (error) {
    console.error(`❌: Error adding card ${cardId} to player ${playerId}:`, error);
    throw error; // Пробрасываем ошибку дальше для обработки выше
  }
}

// Удаление карты у игрока
export async function deletePlayerCard(userId: string, cardId: string) {
  try {
    console.log(`🎮 Finding card ${cardId} for player ${userId}`);

    // Сначала находим ID карты игрока
    interface PlayerCardResponse {
      playerCards: Array<{ id: string }>;
    }

    const cardData = await client.request<PlayerCardResponse>(GET_PLAYER_CARD, {
      userId,
      cardId: cardId.toString()
    });

    if (!cardData.playerCards || cardData.playerCards.length === 0) {
      throw new Error(`Card ${cardId} not found for player ${userId}`);
    }

    // Берем первую найденную карту (должна быть только одна)
    const playerCardId = cardData.playerCards[0].id;

    console.log(`🎮 Deleting player card with ID: ${playerCardId}`);

    // Теперь удаляем карту по её уникальному ID
    interface DeleteCardResponse {
      deletePlayerCard: {
        id: string;
      };
    }

    const data = await client.request<DeleteCardResponse>(DELETE_PLAYER_CARD, {
      id: playerCardId
    });

    console.log('🎮 Card deleted:', data);
    return data.deletePlayerCard;
  } catch (error) {
    console.error('❌ Error deleting player card:', error);
    throw error;
  }
}

export async function getAllUsers() {
  try {
    const data = await client.request<{ users: { telegram_id: string }[] }>(GET_ALL_USERS);
    return data.users.map(user => user.telegram_id);
  } catch (error) {
    console.error('❌: Error getting all users:', error);
    return [];
  }
}

// Восстановление карт пользователя
export async function restoreUserCards(userId: string) {
  try {
    console.log('🎮 Восстанавливаем карты для пользователя:', userId);
    
    // Получаем 6 случайных карт из первых трех уровней
    const starterCards = Card.getStarterCards().slice(0, 6);
    
    const addCardPromises = starterCards.map(card =>
      addCardToPlayer(userId, card.id)
        .then(addedCard => {
          console.log(`🎮 Успешно добавлена карта ${card.id}`);
          return addedCard;
        })
        .catch(error => {
          console.error(`❌ Ошибка при добавлении карты ${card.id}:`, error);
          throw error;
        })
    );

    const addedCards = await Promise.all(addCardPromises);
    console.log('🎮 Успешно добавлены все карты:', addedCards);

    return addedCards;
  } catch (error) {
    console.error('❌ Ошибка при восстановлении карт:', error);
    throw error;
  }
}