export interface Settings {
  AI_PLAYER: 'BALANCED';
  AI_OPPONENT: 'BALANCED';
  userId: string;
  playerCards: Array<{ id: string; cardId: string; }>
}

export interface Rules {
  OPEN: boolean;
  SAME: boolean;
  SAME_WALL: boolean;
  PLUS: boolean;
  COMBO: boolean;
  ELEMENTAL: boolean;
  SUDDEN_DEATH: boolean;
}

export type ElementType = 'EARTH' | 'FIRE' | 'HOLY' | 'ICE' | 'POISON' | 'THUNDER' | 'WATER' | 'WIND';

export interface AiCard {
  id: string;
  name: string;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  element?: null | ElementType;
  imageUrl: string;
  hidden: boolean;
  owner: 'player' | 'ai';
  originalOwner: 'player' | 'ai';
}

export interface PlayerCard {
  id: string;
  name: string;
  top: number;
  right: number;
  bottom: number;
  left: number;
  element: null | ElementType;
  imageUrl: string;
  hidden: boolean;
  owner: 'player' | 'ai';
  originalOwner: 'player' | 'ai';
  position: number;
}

export interface GameState {
  settings: Settings;
  rules: Rules;
  board: Array<null | PlayerCard>;
  boardElements: Array<null | string>;
  playerHand: Array<PlayerCard>;
  aiHand: Array<AiCard>;
  currentTurn: 'player' | 'ai';
  playerScore: number;
  aiScore: number;
  gameStatus: 'playing' | 'finished' | 'sudden_death';
  winner: 'player' | 'ai' | 'draw' | null;
}

export interface ActiveGame {
  id: string;
  gameId: string;
  gameState: GameState;
}
