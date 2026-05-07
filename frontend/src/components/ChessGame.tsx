import { useCallback, useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useStockfish } from "../hooks/useStockfish";
import { EvalBar } from "./EvalBar";

interface Props {
  initialFen?: string;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BOARD_WIDTH = 480;

export function ChessGame({ initialFen }: Props) {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(START_FEN);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const { arrows, ready, score, analyze, stop } = useStockfish();

  useEffect(() => {
    if (!initialFen) return;
    try {
      gameRef.current = new Chess(initialFen);
      setFen(gameRef.current.fen());
    } catch {
      console.warn("Invalid FEN:", initialFen);
    }
  }, [initialFen]);

  useEffect(() => {
    if (!ready) return;
    stop();
    analyze(fen);
  }, [fen, ready, analyze, stop]);

  const onDrop = useCallback((from: string, to: string) => {
    try {
      const move = gameRef.current.move({ from, to, promotion: "q" });
      if (!move) return false;
      setFen(gameRef.current.fen());
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleUndo = useCallback(() => {
    gameRef.current.undo();
    setFen(gameRef.current.fen());
  }, []);

  const handleFlip = useCallback(() => {
    setOrientation((o) => (o === "white" ? "black" : "white"));
  }, []);

  const handleSwitchTurn = useCallback(() => {
    const parts = gameRef.current.fen().split(" ");
    parts[1] = parts[1] === "w" ? "b" : "w";
    const newFen = parts.join(" ");
    try {
      gameRef.current = new Chess(newFen);
      setFen(gameRef.current.fen());
    } catch {
      console.warn("Cannot switch turn in this position");
    }
  }, []);

  const handleReset = useCallback(() => {
    const base = initialFen ?? START_FEN;
    gameRef.current = new Chess(base);
    setFen(gameRef.current.fen());
  }, [initialFen]);

  const turn = fen.split(" ")[1] === "w" ? "白方" : "黑方";
  const canUndo = gameRef.current.history().length > 0;

  return (
    <div style={styles.wrapper}>
      <div style={styles.status}>
        {ready ? `引擎就绪 · ${turn}走棋` : "⏳ 引擎加载中..."}
      </div>

      <div style={styles.boardRow}>
        <EvalBar score={score} height={BOARD_WIDTH} />
        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          customArrows={arrows}
          boardWidth={BOARD_WIDTH}
          boardOrientation={orientation}
          customDarkSquareStyle={{ backgroundColor: "#779952" }}
          customLightSquareStyle={{ backgroundColor: "#edeed1" }}
        />
      </div>

      <div style={styles.controls}>
        <button style={styles.btn} onClick={handleUndo} disabled={!canUndo} title="悔棋">
          ↩ 悔棋
        </button>
        <button style={styles.btn} onClick={handleFlip} title="翻转棋盘">
          ⇅ 翻转
        </button>
        <button style={styles.btn} onClick={handleSwitchTurn} title="交换先手">
          ⇄ 换手
        </button>
        <button style={styles.btn} onClick={handleReset} title="回到初始局面">
          ⊙ 复位
        </button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#1e2240",
  border: "1px solid #3a3d5c",
  color: "#99aacc",
  borderRadius: 7,
  padding: "8px 18px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.5,
  transition: "background 0.15s",
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14 },
  status: { fontSize: 13, color: "#8bc", fontWeight: 600, letterSpacing: 0.5 },
  boardRow: { display: "flex", alignItems: "stretch", gap: 8 },
  controls: { display: "flex", gap: 10 },
  btn,
};
