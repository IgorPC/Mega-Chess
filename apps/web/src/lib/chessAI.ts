import { Chess } from 'chess.js';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Piece-square tables (from white's perspective, rank 1 = index 0)
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

function squareIndex(square: string, color: 'w' | 'b'): number {
  const file = square.charCodeAt(0) - 97; // a=0..h=7
  const rank = parseInt(square[1]) - 1;    // 1=0..8=7
  // For white: rank 1 is index 0 of PST (bottom), rank 8 is index 56
  // PST is indexed from rank 8 down to rank 1 (standard orientation)
  const row = color === 'w' ? 7 - rank : rank;
  return row * 8 + file;
}

function evaluate(game: Chess): number {
  const board = game.board();
  let score = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      const base = PIECE_VALUES[cell.type] ?? 0;
      const pst = PST[cell.type]?.[squareIndex(cell.square, cell.color)] ?? 0;
      const value = base + pst;
      score += cell.color === 'w' ? value : -value;
    }
  }
  return score;
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (depth === 0 || game.isGameOver()) return evaluate(game);

  const moves = game.moves({ verbose: false });

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      game.move(move);
      best = Math.max(best, minimax(game, depth - 1, alpha, beta, false));
      game.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      game.move(move);
      best = Math.min(best, minimax(game, depth - 1, alpha, beta, true));
      game.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function randomMove(moves: string[]): string {
  return moves[Math.floor(Math.random() * moves.length)];
}

function mediumMove(game: Chess): string {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return '';

  // Prefer captures by highest captured piece value
  const captures = moves.filter(m => m.captured);
  if (captures.length > 0) {
    captures.sort((a, b) =>
      (PIECE_VALUES[b.captured!] ?? 0) - (PIECE_VALUES[a.captured!] ?? 0),
    );
    // Pick best capture but add some randomness (don't always take the best)
    const topCaptures = captures.slice(0, Math.min(3, captures.length));
    const pick = topCaptures[Math.floor(Math.random() * topCaptures.length)];
    return pick.san;
  }

  // Otherwise random
  return moves[Math.floor(Math.random() * moves.length)].san;
}

function hardMove(game: Chess): string {
  const moves = game.moves({ verbose: false });
  if (moves.length === 0) return '';

  // AI plays as black (minimizing)
  let bestScore = Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    game.move(move);
    const score = minimax(game, 2, -Infinity, Infinity, true); // depth 2 + current = 3 total
    game.undo();
    if (score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

export function getBestMove(fen: string, difficulty: AIDifficulty): string {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: false });
  if (moves.length === 0) return '';

  if (difficulty === 'easy') return randomMove(moves);
  if (difficulty === 'medium') return mediumMove(game);
  return hardMove(game);
}
