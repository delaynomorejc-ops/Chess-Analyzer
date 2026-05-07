import { useState } from "react";
import { ImageUpload } from "./components/ImageUpload";
import { ChessGame } from "./components/ChessGame";

export default function App() {
  const [fen, setFen] = useState<string | undefined>();

  return (
    <div style={styles.root}>
      <h1 style={styles.title}>Chess Analyzer</h1>
      <div style={styles.layout}>
        {/* Left panel */}
        <div style={styles.left}>
          <ImageUpload onFenReady={setFen} />
          {fen && (
            <div style={styles.fenBox}>
              <p style={styles.fenLabel}>FEN</p>
              <code style={styles.fenCode}>{fen}</code>
            </div>
          )}
        </div>

        {/* Board + controls */}
        <ChessGame initialFen={fen} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", padding: "28px 32px", maxWidth: 1100, margin: "0 auto" },
  title: {
    textAlign: "center", fontSize: 26, fontWeight: 700,
    marginBottom: 28, color: "#8bc",
    letterSpacing: 2, textTransform: "uppercase",
  },
  layout: {
    display: "flex", gap: 40, justifyContent: "center",
    alignItems: "flex-start", flexWrap: "wrap",
  },
  left: {
    display: "flex", flexDirection: "column", gap: 16,
    width: 240, paddingTop: 32,
  },
  fenBox: { background: "#0d1117", borderRadius: 8, padding: "10px 12px" },
  fenLabel: { margin: "0 0 4px", fontSize: 10, color: "#445", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  fenCode: { fontSize: 10, color: "#4a7", wordBreak: "break-all", lineHeight: 1.7, fontFamily: "monospace" },
};
