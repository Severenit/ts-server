import { gql } from 'graphql-request';

export const CREATE_USER = gql`
    mutation CreateUser($userData: UserCreateInput!) {
        createUser(data: $userData) {
            id
            telegram_id
            username
            first_name
            last_name
            photo_url
            created_at
            updated_at
            stats {
                id
                total_games
                wins
                losses
                draws
                cards_won
                cards_lost
            }
            playerCards {
                id
                cardId
            }
        }
    }
`;

export const CREATE_USER_STATS = gql`
    mutation CreateUserStats($userId: ID!) {
        createUserStats(data: {
            user: { connect: { id: $userId } }
            total_games: 0
            wins: 0
            losses: 0
            draws: 0
            cards_won: 0
            cards_lost: 0
        }) {
            id
            total_games
            wins
            losses
            draws
            cards_won
            cards_lost
        }
    }
`;

export const GET_USER = gql`
    query GetUser($telegram_id: String!) {
        user(where: { telegram_id: $telegram_id }) {
            id
            telegram_id
            username
            first_name
            last_name
            photo_url
            created_at
            updated_at
            activeGame {
                id
                gameId
            }
            stats {
                id
                total_games
                wins
                losses
                draws
                cards_won
                cards_lost
                experience
                experience_to_next_level
                level
            }
            playerCards {
                id
                cardId
            }
        }
    }
`;

export const GET_USER_CARDS = gql`
    query GetUserCards($telegram_id: String!) {
        playerCards(where: { user: { telegram_id: { equals: $telegram_id } } }) {
            id
            cardId
            createdAt
        }
    }
`;

export const ADD_CARD_TO_USER = gql`
    mutation AddCardToUser($userId: ID!, $cardId: String!) {
        createPlayerCard(data: {
            user: { connect: { id: $userId } }
            cardId: $cardId
        }) {
            cardId
        }
    }
`;

export const GET_USER_STATS = gql`
    query GetUserStats($userId: ID!) {
        user(where: { id: $userId }) {
            stats {
                total_games
                wins
                losses
                draws
                cards_won
                cards_lost
                experience
                level
            }
        }
    }
`;

export const GET_PLAYER_CARD = gql`
    query GetPlayerCard($userId: ID!, $cardId: String!) {
        playerCards(where: {
            AND: [
                { user: { id: { equals: $userId } } },
                { cardId: { equals: $cardId } }
            ]
        }) {
            id
        }
    }
`;

export const DELETE_PLAYER_CARD = gql`
    mutation DeletePlayerCard($id: ID!) {
        deletePlayerCard(where: { id: $id }) {
            id
            cardId
        }
    }
`;

export const GET_ALL_USERS = `
  query GetAllUsers {
    users {
      telegram_id
    }
  }
`;
