import { useCallback, useEffect, useRef, useState } from "react";
import type { Square } from "chess.js";

export type Arrow = [Square, Square, string];

export interface StockfishResult {
  arrows: Arrow[];
  ready: boolean;
  score: number | null;
  analyze: (fen: string) => void;
  stop: () => void;
}

export function useStockfish(): StockfishResult {
  const workerRef = useRef<Worker | null>(null);
  const turnRef = useRef<"w" | "b">("w");
  const isSearchingRef = useRef(false);
  const pendingFenRef = useRef<string | null>(null);

  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [ready, setReady] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // startSearch is stable — only called internally
  const startSearch = useCallback((fen: string) => {
    const w = workerRef.current;
    if (!w) return;
    turnRef.current = fen.split(" ")[1] === "b" ? "b" : "w";
    isSearchingRef.current = true;
    setArrows([]);
    setScore(null);
    w.postMessage("ucinewgame");
    w.postMessage(`position fen ${fen}`);
    w.postMessage("go depth 20");
  }, []);

  useEffect(() => {
    const worker = new Worker("/stockfish.js");
    workerRef.current = worker;

    worker.onerror = (e) => console.error("[Stockfish]", e.message);

    worker.onmessage = (e: MessageEvent) => {
      const line: unknown = e.data;
      if (typeof line !== "string") return;

      if (line.includes("readyok")) setReady(true);

      if (line.startsWith("info") && line.includes("score")) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        let raw: number | null = null;
        if (cpMatch) raw = parseInt(cpMatch[1]);
        else if (mateMatch) raw = parseInt(mateMatch[1]) > 0 ? 99999 : -99999;
        if (raw !== null) setScore(turnRef.current === "w" ? raw : -raw);

        if (line.includes(" pv ")) {
          const depthMatch = line.match(/\bdepth (\d+)/);
          if (depthMatch && parseInt(depthMatch[1]) >= 5) {
            const pv = line.match(/\bpv\s+([a-h][1-8])([a-h][1-8])/);
            if (pv) setArrows([[pv[1] as Square, pv[2] as Square, "rgba(0,180,90,0.85)"]]);
          }
        }
      }

      if (line.startsWith("bestmove")) {
        isSearchingRef.current = false;
        const move = line.split(" ")[1];
        if (move && move !== "(none)") {
          setArrows([[move.slice(0, 2) as Square, move.slice(2, 4) as Square, "rgb(0,220,80)"]]);
        }
        // If a new analysis was queued while engine was searching, run it now
        if (pendingFenRef.current) {
          const next = pendingFenRef.current;
          pendingFenRef.current = null;
          startSearch(next);
        }
      }
    };

    worker.postMessage("uci");
    worker.postMessage("isready");
    return () => worker.terminate();
  }, [startSearch]);

  const stop = useCallback(() => {
    workerRef.current?.postMessage("stop");
  }, []);

  const analyze = useCallback((fen: string) => {
    if (isSearchingRef.current) {
      // queue the new position; startSearch will be called when bestmove arrives
      pendingFenRef.current = fen;
      workerRef.current?.postMessage("stop");
    } else {
      startSearch(fen);
    }
  }, [startSearch]);

  return { arrows, ready, score, analyze, stop };
}
