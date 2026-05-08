import { Chess } from 'chess.js';
import type { MoveAnalysis, PieceActivity, SilmanImbalance, BlunderEntry, PhaseAcl, PhaseBoundaries, ErrorType } from '../types';

export function detectPhaseBoundaries(
  positions: Array<{ fen: string; san: string }>,
): PhaseBoundaries {
  let opening_end = Math.min(14, positions.length - 1);
  let endgame_start = positions.length;

  for (let i = 4; i < positions.length; i++) {
    const chess = new Chess(positions[i].fen);
    const board = chess.board();
    const pieces = board.flat().filter(Boolean);

    const whiteCastled = detectCastled(positions.slice(0, i + 1), 'w');
    const blackCastled = detectCastled(positions.slice(0, i + 1), 'b');

    if (i < 20 && (whiteCastled || blackCastled) && i > opening_end) {
      opening_end = i;
    }
    if (i < 16) {
      const whiteBackRank = board[7].filter(p => p && p.color === 'w' && p.type !== 'k' && p.type !== 'r').length;
      const blackBackRank = board[0].filter(p => p && p.color === 'b' && p.type !== 'k' && p.type !== 'r').length;
      if (whiteBackRank === 0 && blackBackRank === 0 && i > opening_end) {
        opening_end = i;
      }
    }

    const material = calcMaterial(pieces);
    if (material <= 26 && endgame_start === positions.length) {
      endgame_start = i;
    }
  }

  if (endgame_start <= opening_end + 5) endgame_start = positions.length;
  return { opening_end, endgame_start };
}

function detectCastled(positions: Array<{ san: string }>, color: 'w' | 'b'): boolean {
  return positions.some(p => {
    if (color === 'w' && (p.san === 'O-O' || p.san === 'O-O-O')) return true;
    return false;
  });
}

function calcMaterial(pieces: Array<{ type: string } | null>): number {
  const values: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };
  return pieces.reduce((sum, p) => sum + (p ? (values[p.type] ?? 0) : 0), 0);
}

export function calcPhaseAcl(
  moves: MoveAnalysis[],
  boundaries: PhaseBoundaries,
): PhaseAcl {
  const openingMoves = moves.filter(m => m.moveNumber <= boundaries.opening_end);
  const endgameMoves = moves.filter(m => m.moveNumber >= boundaries.endgame_start);
  const middleMoves = moves.filter(
    m => m.moveNumber > boundaries.opening_end && m.moveNumber < boundaries.endgame_start,
  );

  const avgLoss = (ms: MoveAnalysis[]) => {
    const losses = ms.filter(m => m.delta < 0).map(m => Math.abs(m.delta));
    if (losses.length === 0) return 0;
    return Math.round(losses.reduce((a, b) => a + b, 0) / ms.length);
  };

  return {
    opening: avgLoss(openingMoves),
    middlegame: avgLoss(middleMoves),
    endgame: avgLoss(endgameMoves),
  };
}

export function classifyError(
  idx: number,
  moves: MoveAnalysis[],
): ErrorType | null {
  const move = moves[idx];
  if (Math.abs(move.delta) < 50) return null;

  const delta = Math.abs(move.delta);
  if (delta < 50) return null;

  // Psychological: drop from a winning position (score was > +150cp for player)
  const prevScore = idx > 0 ? moves[idx - 1].score : 0;
  const playerAdvantage = move.color === 'white' ? prevScore ?? 0 : -(prevScore ?? 0);

  if (playerAdvantage > 150 && delta >= 100) return '心理';

  // Tactical: single step large drop
  if (delta >= 200) return '战术';

  // Strategic: gradual decline (look back 3+ moves for gradual loss)
  if (idx >= 3) {
    const window = moves.slice(Math.max(0, idx - 4), idx + 1);
    const allSmall = window.every(m => Math.abs(m.delta) < 200);
    const totalLoss = window.reduce((sum, m) => sum + Math.abs(Math.min(m.delta, 0)), 0);
    if (allSmall && totalLoss >= 100) return '战略';
  }

  if (delta >= 50) return '战术';
  return null;
}

export function analyzePieceActivity(
  positions: Array<{ fen: string; san: string }>,
  playerColor: 'white' | 'black',
): PieceActivity[] {
  const colorChar = playerColor === 'white' ? 'w' : 'b';
  const movesByPiece: Record<string, number> = {};
  const currentSquare: Record<string, string> = {};

  if (positions.length === 0) return [];

  const initialChess = new Chess(positions[0].fen);
  const board = initialChess.board();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === colorChar && piece.type !== 'p') {
        const square = String.fromCharCode(97 + col) + (8 - row);
        const key = piece.type.toUpperCase() + square;
        movesByPiece[key] = 0;
        currentSquare[key] = square;
      }
    }
  }

  for (let i = 1; i < positions.length; i++) {
    const chess = new Chess(positions[i].fen);
    const prevChess = new Chess(positions[i - 1].fen);
    const prevBoard = prevChess.board();
    const currBoard = chess.board();
    const currentTurn = prevChess.turn() === colorChar ? 'player' : 'opponent';
    if (currentTurn !== 'player') continue;

    // Detect which piece moved
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const prev = prevBoard[row][col];
        const curr = currBoard[row][col];
        if (prev && prev.color === colorChar && !curr) {
          // Piece left this square
          const fromSquare = String.fromCharCode(97 + col) + (8 - row);
          // Find where it went
          for (let r2 = 0; r2 < 8; r2++) {
            for (let c2 = 0; c2 < 8; c2++) {
              const dest = currBoard[r2][c2];
              if (dest && dest.color === colorChar && dest.type === prev.type) {
                const prevSq = currentSquare[prev.type.toUpperCase() + fromSquare];
                if (prevSq === fromSquare) {
                  const toSquare = String.fromCharCode(97 + c2) + (8 - r2);
                  const key = prev.type.toUpperCase() + fromSquare;
                  if (movesByPiece[key] !== undefined) {
                    movesByPiece[key]++;
                    currentSquare[key] = toSquare;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return Object.entries(movesByPiece).map(([key, count]) => {
    const square = currentSquare[key] ?? key.slice(1);
    return {
      piece: key,
      square,
      moveCount: count,
      isZombie: count <= 1,
      trappedSince: count === 0 ? 0 : null,
    };
  });
}

export function detectZombiePieces(
  positions: Array<{ fen: string; san: string }>,
  playerColor: 'white' | 'black',
): string[] {
  const activity = analyzePieceActivity(positions, playerColor);
  return activity.filter(p => p.isZombie).map(p => p.piece);
}

export function detectPlanBreak(moves: MoveAnalysis[]): number | null {
  // Plan break = piece returns to origin/adjacent square within 5 moves
  // Or score shows a slow decline starting point
  let slowDeclineStart: number | null = null;
  let declineLength = 0;

  for (let i = 1; i < moves.length; i++) {
    if (moves[i].delta < -20) {
      declineLength++;
      if (slowDeclineStart === null) slowDeclineStart = i;
      if (declineLength >= 5 && Math.abs(moves[i].delta) < 200) {
        return slowDeclineStart;
      }
    } else {
      declineLength = 0;
      slowDeclineStart = null;
    }
  }
  return null;
}

export function calcSilmanImbalances(fen: string): SilmanImbalance {
  const chess = new Chess(fen);
  const board = chess.board();
  const pieces = board.flat().filter(Boolean);

  const whitePieces = pieces.filter(p => p?.color === 'w');
  const blackPieces = pieces.filter(p => p?.color === 'b');

  // Pawn structure: doubled/isolated pawns (negative = worse)
  const whitePawns = whitePieces.filter(p => p?.type === 'p');
  const blackPawns = blackPieces.filter(p => p?.type === 'p');
  const pawnStructure = whitePawns.length - blackPawns.length;

  // Piece quality: bishop pair bonus
  const whiteHasBishopPair = whitePieces.filter(p => p?.type === 'b').length === 2;
  const blackHasBishopPair = blackPieces.filter(p => p?.type === 'b').length === 2;
  const pieceQuality = (whiteHasBishopPair ? 1 : 0) - (blackHasBishopPair ? 1 : 0);

  // Open files: count files with no pawns (both open) - rough approximation
  let openFiles = 0;
  for (let col = 0; col < 8; col++) {
    const hasPawn = board.some(row => row[col]?.type === 'p');
    if (!hasPawn) openFiles++;
  }

  // Development: pieces still on back rank
  const whiteBackRankPieces = board[7].filter(p => p && p.color === 'w' && p.type !== 'k').length;
  const blackBackRankPieces = board[0].filter(p => p && p.color === 'b' && p.type !== 'k').length;
  const development = blackBackRankPieces - whiteBackRankPieces;

  // King safety: pawn shield (simplified)
  let kingSafety = 0;
  const whiteKing = board.flat().find(p => p?.type === 'k' && p.color === 'w');
  const blackKing = board.flat().find(p => p?.type === 'k' && p.color === 'b');
  if (whiteKing && blackKing) {
    // Placeholder: just return 0 for now
    kingSafety = 0;
  }

  return { pawnStructure, pieceQuality, openFiles, space: 0, kingSafety, development };
}

export function buildScoreCurve(moves: MoveAnalysis[]): number[] {
  return moves.map(m => m.score ?? 0);
}

export function detectBlunders(moves: MoveAnalysis[]): BlunderEntry[] {
  const blunders: BlunderEntry[] = [];
  for (let i = 0; i < moves.length; i++) {
    const delta = moves[i].delta;
    if (Math.abs(delta) >= 50) {
      const errType = classifyError(i, moves) ?? '战术';
      blunders.push({
        move: moves[i].moveNumber,
        type: errType,
        magnitude: Math.abs(delta),
        actualMove: moves[i].san,
        bestMove: moves[i].bestMove ?? '',
      });
    }
  }
  return blunders;
}

export function extractEcoFromPgn(pgn: string): { eco: string; opening: string } {
  const ecoMatch = pgn.match(/\[ECO "([^"]+)"\]/);
  const openingMatch = pgn.match(/\[Opening "([^"]+)"\]/);
  return {
    eco: ecoMatch?.[1] ?? '?',
    opening: openingMatch?.[1] ?? '未知开局',
  };
}

export function extractDateFromPgn(pgn: string): string {
  const match = pgn.match(/\[Date "([^"]+)"\]/);
  if (!match) return new Date().toISOString().split('T')[0];
  return match[1].replace(/\./g, '-').replace('??', '01');
}

export function extractResultFromPgn(pgn: string): '1-0' | '0-1' | '1/2-1/2' | '*' {
  const match = pgn.match(/\[Result "([^"]+)"\]/);
  const r = match?.[1];
  if (r === '1-0' || r === '0-1' || r === '1/2-1/2') return r;
  return '*';
}

export function extractPlayersFromPgn(pgn: string): { white: string; black: string } {
  const whiteMatch = pgn.match(/\[White "([^"]+)"\]/);
  const blackMatch = pgn.match(/\[Black "([^"]+)"\]/);
  return {
    white: whiteMatch?.[1] ?? '白方',
    black: blackMatch?.[1] ?? '黑方',
  };
}

export function matchOpeningCategory(pgn: string, categoryMoves: string[]): boolean {
  if (categoryMoves.length === 0) return false;
  const gameMoves = extractMovesFromPgn(pgn);
  for (let i = 0; i < categoryMoves.length; i++) {
    if (i >= gameMoves.length) return false;
    const expected = categoryMoves[i];
    if (gameMoves[i] !== expected) return false;
  }
  return true;
}

export function extractMovesFromPgn(pgn: string): string[] {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return [];
  }
  const history = chess.history({ verbose: true });
  return history.map(m => m.from + m.to);
}

export function detectNoveltyPoint(
  pgn: string,
  referenceLines: string[][],
): number | null {
  const moves = extractMovesFromPgn(pgn);
  for (let i = 0; i < moves.length; i++) {
    const matchesAny = referenceLines.some(line => line[i] === moves[i]);
    if (!matchesAny) return i + 1;
  }
  return null;
}
