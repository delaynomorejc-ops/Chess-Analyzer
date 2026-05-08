import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { MoveAnalysis } from '../types';

export interface AnalysisProgress {
  current: number;
  total: number;
  done: boolean;
}

export interface GameAnalysisResult {
  moves: MoveAnalysis[];
  progress: AnalysisProgress;
  analyzeGame: (pgn: string, playerColor: 'white' | 'black') => void;
  reset: () => void;
}

export function useGameAnalysis(): GameAnalysisResult {
  const workerRef = useRef<Worker | null>(null);
  const [moves, setMoves] = useState<MoveAnalysis[]>([]);
  const [progress, setProgress] = useState<AnalysisProgress>({ current: 0, total: 0, done: false });

  const pendingPositionsRef = useRef<Array<{ fen: string; san: string; moveNumber: number; color: 'white' | 'black' }>>([]);
  const currentIndexRef = useRef(0);
  const scoresRef = useRef<Array<number | null>>([]);
  const bestMovesRef = useRef<Array<string | null>>([]);
  const isReadyRef = useRef(false);
  const playerColorRef = useRef<'white' | 'black'>('white');

  useEffect(() => {
    const worker = new Worker('/stockfish.js');
    workerRef.current = worker;

    worker.onerror = (e) => console.error('[Stockfish]', e.message);

    worker.onmessage = (e: MessageEvent) => {
      const line: unknown = e.data;
      if (typeof line !== 'string') return;

      if (line.includes('readyok')) {
        isReadyRef.current = true;
        if (currentIndexRef.current < pendingPositionsRef.current.length) {
          sendNextPosition();
        }
        return;
      }

      if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const depthMatch = line.match(/\bdepth (\d+)/);
        if (depthMatch && parseInt(depthMatch[1]) >= 15) {
          if (cpMatch) {
            const idx = currentIndexRef.current;
            const pos = pendingPositionsRef.current[idx];
            const raw = parseInt(cpMatch[1]);
            const score = pos && pos.color === 'black' ? -raw : raw;
            scoresRef.current[idx] = score;
          } else if (mateMatch) {
            const idx = currentIndexRef.current;
            const raw = parseInt(mateMatch[1]);
            scoresRef.current[idx] = raw > 0 ? 99999 : -99999;
          }
          const pvMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (pvMatch) {
            bestMovesRef.current[currentIndexRef.current] = pvMatch[1];
          }
        }
      }

      if (line.startsWith('bestmove')) {
        const moveMatch = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (moveMatch && !bestMovesRef.current[currentIndexRef.current]) {
          bestMovesRef.current[currentIndexRef.current] = moveMatch[1];
        }

        const idx = currentIndexRef.current;
        currentIndexRef.current++;

        const total = pendingPositionsRef.current.length;
        setProgress({ current: idx + 1, total, done: idx + 1 >= total });

        if (currentIndexRef.current < total) {
          sendNextPosition();
        } else {
          finalizeResults();
        }
      }
    };

    worker.postMessage('uci');
    worker.postMessage('isready');

    return () => worker.terminate();
  }, []);

  function sendNextPosition() {
    const worker = workerRef.current;
    if (!worker) return;
    const idx = currentIndexRef.current;
    const pos = pendingPositionsRef.current[idx];
    if (!pos) return;
    worker.postMessage('ucinewgame');
    worker.postMessage(`position fen ${pos.fen}`);
    worker.postMessage('go depth 18');
  }

  function finalizeResults() {
    const positions = pendingPositionsRef.current;
    const scores = scoresRef.current;
    const bestMoves = bestMovesRef.current;

    const result: MoveAnalysis[] = positions.map((pos, i) => {
      const prevScore = i > 0 ? (scores[i - 1] ?? 0) : 0;
      const currScore = scores[i] ?? prevScore;
      const delta = currScore - prevScore;

      return {
        fen: pos.fen,
        san: pos.san,
        score: currScore,
        bestMove: bestMoves[i] ?? null,
        delta,
        errorType: null,
        moveNumber: pos.moveNumber,
        color: pos.color,
      };
    });

    // Classify errors after computing all deltas
    for (let i = 0; i < result.length; i++) {
      const delta = result[i].delta;
      const color = result[i].color;
      const playerMultiplier = playerColorRef.current === color ? -1 : 1;
      const playerLoss = delta * playerMultiplier;

      if (playerLoss >= 50) {
        const prevScore = i > 0 ? result[i - 1].score ?? 0 : 0;
        const playerAdvantage = playerColorRef.current === 'white' ? prevScore : -prevScore;

        if (playerAdvantage > 150 && playerLoss >= 100) {
          result[i].errorType = '心理';
        } else if (playerLoss >= 200) {
          result[i].errorType = '战术';
        } else if (i >= 3) {
          const window = result.slice(Math.max(0, i - 4), i + 1);
          const allSmall = window.every(m => {
            const loss = m.delta * (playerColorRef.current === m.color ? -1 : 1);
            return loss < 200;
          });
          const totalLoss = window.reduce((sum, m) => {
            const loss = m.delta * (playerColorRef.current === m.color ? -1 : 1);
            return sum + Math.max(0, loss);
          }, 0);
          if (allSmall && totalLoss >= 100) {
            result[i].errorType = '战略';
          } else {
            result[i].errorType = '战术';
          }
        } else {
          result[i].errorType = '战术';
        }
      }
    }

    setMoves(result);
  }

  const analyzeGame = useCallback((pgn: string, playerColor: 'white' | 'black') => {
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch {
      console.error('Invalid PGN');
      return;
    }

    playerColorRef.current = playerColor;
    const history = chess.history({ verbose: true });
    const positions: Array<{ fen: string; san: string; moveNumber: number; color: 'white' | 'black' }> = [];

    const replay = new Chess();
    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const color = move.color === 'w' ? 'white' : 'black';
      replay.move(move.san);
      positions.push({
        fen: replay.fen(),
        san: move.san,
        moveNumber: Math.floor(i / 2) + 1,
        color,
      });
    }

    pendingPositionsRef.current = positions;
    currentIndexRef.current = 0;
    scoresRef.current = new Array(positions.length).fill(null);
    bestMovesRef.current = new Array(positions.length).fill(null);
    setMoves([]);
    setProgress({ current: 0, total: positions.length, done: false });

    if (isReadyRef.current) {
      sendNextPosition();
    }
  }, []);

  const reset = useCallback(() => {
    pendingPositionsRef.current = [];
    currentIndexRef.current = 0;
    scoresRef.current = [];
    bestMovesRef.current = [];
    setMoves([]);
    setProgress({ current: 0, total: 0, done: false });
  }, []);

  return { moves, progress, analyzeGame, reset };
}
