interface Props {
  score: number | null;
  height: number;
}

export function EvalBar({ score, height }: Props) {
  const isMate = score !== null && Math.abs(score) >= 99000;
  const clamped = score === null ? 0 : Math.max(-1000, Math.min(1000, score));
  // whitePct: 0 = all black, 100 = all white; 50 = equal
  const whitePct = score === null ? 50 : isMate
    ? (score > 0 ? 100 : 0)
    : 50 + clamped / 20;

  const labelVal = score === null
    ? "0.0"
    : isMate
      ? `M${Math.abs(score) === 99999 ? "∞" : ""}`
      : `${score >= 0 ? "+" : ""}${(score / 100).toFixed(1)}`;

  const labelOnWhite = whitePct > 50;

  return (
    <div style={styles.bar(height)}>
      {/* Black section (top) */}
      <div style={styles.black(100 - whitePct)} />
      {/* White section (bottom) */}
      <div style={styles.white(whitePct)} />
      {/* Score label */}
      <div style={styles.label(labelOnWhite ? 100 - whitePct : whitePct, labelOnWhite)}>
        {labelVal}
      </div>
    </div>
  );
}

const styles = {
  bar: (height: number): React.CSSProperties => ({
    width: 22,
    height,
    display: "flex",
    flexDirection: "column",
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  }),
  black: (pct: number): React.CSSProperties => ({
    flex: pct,
    background: "#1c1c1c",
    transition: "flex 0.4s ease",
    minHeight: 0,
  }),
  white: (pct: number): React.CSSProperties => ({
    flex: pct,
    background: "#f0ede8",
    transition: "flex 0.4s ease",
    minHeight: 0,
  }),
  label: (offsetPct: number, onWhite: boolean): React.CSSProperties => ({
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%) rotate(-90deg)",
    top: onWhite ? `${offsetPct}%` : undefined,
    bottom: onWhite ? undefined : `${offsetPct}%`,
    color: onWhite ? "#333" : "#ccc",
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "monospace",
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
    userSelect: "none",
    lineHeight: 1,
  }),
};
