import type { SilmanImbalance } from '../../types';
import { calcSilmanImbalances } from '../../lib/analysis';

interface SilmanPanelProps {
  fen: string;
}

const LABELS: Array<{ key: keyof SilmanImbalance; name: string; desc: string }> = [
  { key: 'pawnStructure', name: '兵结构', desc: '通路兵、孤兵、叠兵' },
  { key: 'pieceQuality', name: '棋子质量', desc: '好象vs坏象、主动马' },
  { key: 'openFiles', name: '开放线', desc: '开放/半开放线数量' },
  { key: 'space', name: '空间', desc: '控制格子数量' },
  { key: 'kingSafety', name: '王安全', desc: '王位屏障完整性' },
  { key: 'development', name: '发展速度', desc: '未出子数量差' },
];

export function SilmanPanel({ fen }: SilmanPanelProps) {
  const imbalances = calcSilmanImbalances(fen);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>Silman 不平衡</div>
      <div style={styles.list}>
        {LABELS.map(({ key, name, desc }) => {
          const value = key === 'openFiles' ? imbalances[key] : imbalances[key];
          const bar = key === 'openFiles'
            ? Math.min(value / 8, 1)
            : (value + 2) / 4;
          const clamped = Math.max(0, Math.min(1, bar));

          return (
            <div key={key} style={styles.row}>
              <div style={styles.labelWrap}>
                <span style={styles.label}>{name}</span>
                <span style={styles.desc}>{desc}</span>
              </div>
              <div style={styles.barWrap}>
                <div style={{ ...styles.bar, width: `${clamped * 100}%` }} />
                <div style={styles.midLine} />
              </div>
              <span style={{
                ...styles.val,
                color: value > 0 ? '#81c995' : value < 0 ? '#f87171' : '#6b7280',
              }}>
                {value > 0 ? '+' : ''}{value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { background: '#111827', borderRadius: 8, border: '1px solid #1f2937', padding: 10 },
  header: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  labelWrap: { width: 64, flexShrink: 0 },
  label: { display: 'block', fontSize: 11, color: '#d1d5db', fontWeight: 500 },
  desc: { display: 'block', fontSize: 9, color: '#4b5563' },
  barWrap: { flex: 1, height: 6, background: '#1f2937', borderRadius: 3, position: 'relative', overflow: 'hidden' },
  bar: { height: '100%', background: '#4b9e6b', borderRadius: 3, transition: 'width 0.3s' },
  midLine: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#374151' },
  val: { width: 24, textAlign: 'right', fontSize: 11, fontWeight: 600, flexShrink: 0 },
};
