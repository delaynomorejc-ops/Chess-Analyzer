import type { MoveAnalysis } from '../../types';

interface MoveListProps {
  moves: MoveAnalysis[];
  currentIdx: number;
  onSelect: (idx: number) => void;
}

const ERROR_COLOR: Record<string, string> = {
  '战术': '#ef4444',
  '战略': '#f97316',
  '心理': '#a855f7',
};

const ERROR_ICON: Record<string, string> = {
  '战术': '?!',
  '战略': '≈',
  '心理': '~',
};

export function MoveList({ moves, currentIdx, onSelect }: MoveListProps) {
  const pairs: Array<{ num: number; white?: MoveAnalysis; black?: MoveAnalysis; wIdx: number; bIdx: number }> = [];

  for (let i = 0; i < moves.length; i += 2) {
    const w = moves[i];
    const b = moves[i + 1];
    pairs.push({ num: w?.moveNumber ?? Math.floor(i / 2) + 1, white: w, black: b, wIdx: i, bIdx: i + 1 });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>棋步列表</div>
      <div style={styles.list}>
        {pairs.map(p => (
          <div key={p.num} style={styles.row}>
            <span style={styles.num}>{p.num}.</span>
            <MoveCell
              move={p.white}
              isActive={currentIdx === p.wIdx}
              onClick={() => onSelect(p.wIdx)}
            />
            <MoveCell
              move={p.black}
              isActive={currentIdx === p.bIdx}
              onClick={() => onSelect(p.bIdx)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MoveCell({ move, isActive, onClick }: {
  move?: MoveAnalysis; isActive: boolean; onClick: () => void;
}) {
  if (!move) return <span style={styles.emptyCell} />;
  const errColor = move.errorType ? ERROR_COLOR[move.errorType] : undefined;
  const errIcon = move.errorType ? ERROR_ICON[move.errorType] : undefined;

  return (
    <button
      style={{
        ...styles.cell,
        ...(isActive ? styles.cellActive : {}),
        ...(errColor ? { borderBottom: `2px solid ${errColor}` } : {}),
      }}
      onClick={onClick}
    >
      <span>{move.san}</span>
      {errIcon && <sup style={{ color: errColor, fontSize: 9, marginLeft: 1 }}>{errIcon}</sup>}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: '#111827', borderRadius: 8, border: '1px solid #1f2937',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 220,
  },
  header: { fontSize: 11, fontWeight: 600, color: '#6b7280', padding: '6px 10px', borderBottom: '1px solid #1f2937', textTransform: 'uppercase', letterSpacing: 1 },
  list: { overflow: 'auto', flex: 1, padding: '4px 0' },
  row: { display: 'flex', alignItems: 'center', padding: '1px 6px' },
  num: { width: 28, fontSize: 11, color: '#4b5563', textAlign: 'right', paddingRight: 4, flexShrink: 0 },
  cell: {
    flex: 1, background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
    color: '#d1d5db', padding: '3px 6px', cursor: 'pointer', fontSize: 12,
    textAlign: 'left', borderRadius: 4,
  },
  cellActive: { background: '#1e3a2f', color: '#81c995' },
  emptyCell: { flex: 1 },
};
