import { create } from 'zustand';

interface GamePlayer {
  id: string;
  nickname: string;
  avatarUrl?: string;
  rating: number;
}

interface GameState {
  matchId: string | null;
  myColor: 'white' | 'black' | null;
  fen: string;
  pgn: string;
  moves: string[];
  currentTurn: 'white' | 'black';
  timerSeconds: number;
  status: 'idle' | 'searching' | 'playing' | 'finished';
  result: string | null;
  resultReason: string | null;
  whitePlayer: GamePlayer | null;
  blackPlayer: GamePlayer | null;
  chatMessages: { id: string; content: string; sender: { nickname: string; avatarUrl?: string }; createdAt: string }[];

  setMatch: (matchId: string, color: 'white' | 'black', white: GamePlayer, black: GamePlayer) => void;
  setFen: (fen: string, pgn: string, moves: string[], turn: 'white' | 'black') => void;
  setTimer: (seconds: number) => void;
  setStatus: (status: GameState['status']) => void;
  setResult: (result: string, reason: string) => void;
  addChatMessage: (msg: GameState['chatMessages'][0]) => void;
  reset: () => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const useGameStore = create<GameState>((set) => ({
  matchId: null,
  myColor: null,
  fen: INITIAL_FEN,
  pgn: '',
  moves: [],
  currentTurn: 'white',
  timerSeconds: 60,
  status: 'idle',
  result: null,
  resultReason: null,
  whitePlayer: null,
  blackPlayer: null,
  chatMessages: [],

  setMatch: (matchId, myColor, whitePlayer, blackPlayer) =>
    set({ matchId, myColor, whitePlayer, blackPlayer, status: 'playing', fen: INITIAL_FEN, moves: [], pgn: '', result: null, resultReason: null, chatMessages: [] }),

  setFen: (fen, pgn, moves, currentTurn) => set({ fen, pgn, moves, currentTurn }),
  setTimer: (timerSeconds) => set({ timerSeconds }),
  setStatus: (status) => set({ status }),
  setResult: (result, resultReason) => set({ result, resultReason, status: 'finished' }),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  reset: () => set({
    matchId: null, myColor: null, fen: INITIAL_FEN, pgn: '', moves: [],
    currentTurn: 'white', timerSeconds: 60, status: 'idle',
    result: null, resultReason: null, whitePlayer: null, blackPlayer: null, chatMessages: [],
  }),
}));
