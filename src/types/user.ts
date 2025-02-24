export interface User {
  id: string;
  activeGame: string | null;
  isNewPlayer: boolean;
  telegram_id: string;
  username: string;
  first_name: string;
  last_name: string;
  photo_url: string;
  created_at: string;
  updated_at: string;
  stats: {
    id: string;
    total_games: number;
    wins: number;
    losses: number;
    draws: number;
    cards_won: number;
    cards_lost: number;
  };
  playerCards: Array<{
    id: string;
    cardId: string;
  }> | [];
}