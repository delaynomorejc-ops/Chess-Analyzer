import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import type { MoveAnalysis } from '../../types';

interface ScoreCurveProps {
  moves: MoveAnalysis[];
  currentMove: number;
  playerColor: 'white' | 'black';
  onMoveClick: (idx: number) => void;
}

export function ScoreCurve({ moves, currentMove, playerColor, onMoveClick }: ScoreCurveProps) {
  const data = moves.map((m, i) => ({
    idx: i,
    label: `${m.moveNumber}${m.color === 'white' ? '.' : '...'}${m.san}`,
    score: Math.max(-800, Math.min(800, m.score ?? 0)),
    delta: m.delta,
    errorType: m.errorType,
  }));

  function dotColor(entry: typeof data[0]) {
    const loss = playerColor === 'white' ? -entry.delta : entry.delta;
    if (loss >= 500) return '#ef4444';
    if (loss >= 200) return '#f97316';
    if (loss >= 50) return '#eab308';
    return 'transparent';
  }

  const CustomDot = (props: { cx?: number; cy?: number; index?: number; payload?: typeof data[0] }) => {
    const { cx = 0, cy = 0, payload } = props;
    if (!payload) return null;
    const color = dotColor(payload);
    if (color === 'transparent') return null;
    return <circle cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
  };

  return (
    <div style={styles.wrap}>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} onClick={(d) => { if (d?.activeLabel !== undefined) onMoveClick(Number(d.activeLabel)); }}
          margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="idx" hide />
          <YAxis domain={[-800, 800]} tickCount={5} tick={{ fontSize: 9, fill: '#6b7280' }} />
          <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
          <Tooltip
            formatter={(v: unknown) => [`${Number(v) > 0 ? '+' : ''}${(Number(v) / 100).toFixed(1)}`, '评分']}
            labelFormatter={(l: unknown) => data[Number(l)]?.label ?? ''}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 11 }}
            itemStyle={{ color: '#e5e7eb' }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#4b9e6b"
            strokeWidth={1.5}
            dot={<CustomDot />}
            activeDot={{ r: 4, fill: '#81c995' }}
            isAnimationActive={false}
          />
          {currentMove >= 0 && (
            <ReferenceLine x={currentMove} stroke="#81c99580" strokeWidth={1} />
          )}
        </LineChart>
      </ResponsiveContainer>
      <div style={styles.legend}>
        <span style={{ color: '#eab308' }}>● 小失误 50–200cp</span>
        <span style={{ color: '#f97316' }}>● 错误 200–500cp</span>
        <span style={{ color: '#ef4444' }}>● 决定性失误 &gt;500cp</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { background: '#111827', borderRadius: 8, padding: '8px 4px 4px', border: '1px solid #1f2937' },
  legend: { display: 'flex', gap: 12, padding: '2px 8px', fontSize: 10, color: '#6b7280' },
};
