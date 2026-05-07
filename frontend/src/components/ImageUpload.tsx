import { useRef, useState, useEffect } from "react";
import { recognizePosition } from "../api";

interface Props {
  onFenReady: (fen: string) => void;
}

async function resizeImage(file: File, maxPx = 1200): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
        "image/jpeg",
        0.9
      );
    };
    img.src = url;
  });
}

export function ImageUpload({ onFenReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startTimer() {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function handleFile(file: File) {
    setStatus("loading");
    setErrMsg("");
    startTimer();
    try {
      const compressed = await resizeImage(file);
      const fen = await recognizePosition(compressed);
      onFenReady(fen);
      setStatus("idle");
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    } finally {
      stopTimer();
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div style={styles.section}>
      <p style={styles.label}>上传棋盘截图</p>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => status !== "loading" && inputRef.current?.click()}
        style={{ ...styles.zone, borderColor: status === "loading" ? "#6af" : "#3a3d5c" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {status === "loading" ? (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <p style={{ color: "#6af", margin: 0 }}>识别中...</p>
            <p style={styles.timer}>{elapsed}s</p>
          </div>
        ) : status === "error" ? (
          <div>
            <p style={{ color: "#f77", margin: 0 }}>识别失败</p>
            <p style={{ color: "#f77", fontSize: 11, margin: "4px 0 0" }}>{errMsg}</p>
            <p style={{ color: "#888", fontSize: 11, margin: "8px 0 0" }}>点击重试</p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 28, margin: 0 }}>📷</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#778" }}>点击或拖拽截图</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: { display: "flex", flexDirection: "column", gap: 8 },
  label: { margin: 0, fontSize: 11, color: "#667", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 },
  zone: {
    border: "2px dashed #3a3d5c",
    borderRadius: 10,
    padding: "28px 16px",
    textAlign: "center",
    cursor: "pointer",
    color: "#aaa",
    userSelect: "none",
    transition: "border-color 0.2s",
    minHeight: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loading: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  spinner: {
    width: 28, height: 28,
    border: "3px solid #223",
    borderTop: "3px solid #6af",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  timer: { margin: 0, fontSize: 22, fontWeight: 700, color: "#6af", fontFamily: "monospace" },
};

// inject spin keyframe once
if (typeof document !== "undefined" && !document.getElementById("sf-spin-style")) {
  const s = document.createElement("style");
  s.id = "sf-spin-style";
  s.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}
