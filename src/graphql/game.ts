import { gql } from 'graphql-request';

export const CHECK_ACTIVE_GAME = gql`
    query CheckActiveGame($gameId: String!) {
        activeGame(where: { gameId: $gameId }) {
            id
            gameId
        }
    }
`;

export const CREATE_ACTIVE_GAME = gql`
    mutation CreateActiveGame($gameId: String!, $userId: ID!, $initialState: JSON!) {
        createActiveGame(data: {
            gameId: $gameId
            gameState: $initialState
            user: { connect: { id: $userId } }
        }) {
            id
            gameId
            gameState
        }
    }
`;

export const UPDATE_ACTIVE_GAME = gql`
    mutation UpdateActiveGame($gameId: String!, $initialState: JSON!) {
        updateActiveGame(
            where: { gameId: $gameId }
            data: {
                gameState: $initialState
            }
        ) {
            id
            gameId
            gameState
        }
    }
`;

export const GET_ACTIVE_GAME = gql`
    query GetActiveGameByGameId($gameId: String!) {
        activeGame(where: { gameId: $gameId }) {
            id
            gameId
            gameState
            user {
                id
                username
            }
        }
    }
`;

export const DELETE_ACTIVE_GAME = gql`
    mutation DeleteActiveGame($gameId: String!) {
        deleteActiveGame(where: { gameId: $gameId }) {
            id
            gameId
        }
    }
`;

export const GET_USER_STATS = gql`
    query UserStats(
        $statsId: ID!
    ) {
        userStats(
            where: { id: $statsId }
        ) {
            id
            cards_lost
            cards_won
            experience
            level
            draws
            losses
            total_games
            wins
        }
    }
`;

export const UPDATE_USER_STATS = gql`
    mutation UpdateUserStats(
        $statsId: ID!,
        $wins: Int!,
        $draws: Int!,
        $losses: Int!,
        $totalGames: Int!,
        $wonCards: JSON!,
        $lostCards: JSON!
    ) {
        updateUserStats(
            where: { id: $statsId }
            data: {
                total_games: $totalGames
                wins: $wins
                losses: $losses
                draws: $draws
                cards_won: $wonCards
                cards_lost: $lostCards
            }
        ) {
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