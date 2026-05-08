import type { PieceActivity } from '../../types';

const PIECE_NAMES: Record<string, string> = {
  K: '王', Q: '后', R: '车', B: '象', N: '马', P: '兵',
};

interface PieceActivityPanelProps {
  pieces: PieceActivity[];
}

export function PieceActivityPanel({ pieces }: PieceActivityPanelProps) {
  if (pieces.length === 0) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>棋子活跃度</div>
      <div style={styles.grid}>
        {pieces.map(p => (
          <div key={p.piece} style={{ ...styles.item, ...(p.isZombie ? styles.zombie : {}) }}>
            <span style={styles.pieceName}>
              {PIECE_NAMES[p.piece[0]] ?? p.piece[0]}{p.piece.slice(1)}
            </span>
            <span style={styles.moveCount}>{p.moveCount}步</span>
            {p.isZombie && <span style={styles.zombieBadge}>僵尸</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { background: '#111827', borderRadius: 8, border: '1px solid #1f2937', padding: 10 },
  header: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  item: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: '#1f2937', borderRadius: 6, padding: '3px 7px',
    border: '1px solid #374151',
  },
  zombie: { border: '1px solid #7f1d1d', background: '#1c0e0e' },
  pieceName: { fontSize: 11, color: '#d1d5db', fontWeight: 600 },
  moveCount: { fontSize: 10, color: '#6b7280' },
  zombieBadge: { fontSize: 9, color: '#f87171', background: '#450a0a', borderRadius: 4, padding: '1px 4px' },
};
