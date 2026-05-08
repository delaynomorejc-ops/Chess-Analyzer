import type { MoveAnalysis, PieceActivity } from '../../types';
import { ScoreCurve } from './ScoreCurve';
import { MoveList } from './MoveList';
import { PieceActivityPanel } from './PieceActivityPanel';
import { SilmanPanel } from './SilmanPanel';

interface AnalysisPanelProps {
  moves: MoveAnalysis[];
  currentIdx: number;
  currentFen: string;
  playerColor: 'white' | 'black';
  pieceActivity: PieceActivity[];
  isAnalyzing: boolean;
  progress: { current: number; total: number };
  onMoveSelect: (idx: number) => void;
}

const ERROR_LABELS: Record<string, string> = { '战术': '战术失误', '战略': '战略失误', '心理': '心理失误' };
const ERROR_COLORS: Record<string, string> = { '战术': '#ef4444', '战略': '#f97316', '心理': '#a855f7' };

export function AnalysisPanel({
  moves, currentIdx, currentFen, playerColor,
  pieceActivity, isAnalyzing, progress, onMoveSelect,
}: AnalysisPanelProps) {
  const currentMove = moves[currentIdx];

  return (
    <div style={styles.wrap}>
      {isAnalyzing && (
        <div style={styles.progressBar}>
          <div style={styles.progressLabel}>引擎分析中 {progress.current}/{progress.total}</div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {moves.length > 0 && (
        <>
          <ScoreCurve
            moves={moves}
            currentMove={currentIdx}
            playerColor={playerColor}
            onMoveClick={onMoveSelect}
          />

          {currentMove && (
            <div style={styles.moveInfo}>
              <div style={styles.moveSan}>
                {currentMove.color === 'white' ? '⬜' : '⬛'} {currentMove.moveNumber}.{currentMove.color === 'black' ? '..' : ''} {currentMove.san}
              </div>
              <div style={styles.moveDetails}>
                {currentMove.score !== null && (
                  <span style={styles.score}>
                    {currentMove.score > 0 ? '+' : ''}{(currentMove.score / 100).toFixed(2)}
                  </span>
                )}
                {currentMove.errorType && (
                  <span style={{ ...styles.errorBadge, background: ERROR_COLORS[currentMove.errorType] + '33', color: ERROR_COLORS[currentMove.errorType] }}>
                    {ERROR_LABELS[currentMove.errorType]}
                    {' '}(-{(Math.abs(currentMove.delta) / 100).toFixed(1)})
                  </span>
                )}
                {currentMove.bestMove && currentMove.errorType && (
                  <span style={styles.bestMove}>最佳：{currentMove.bestMove}</span>
                )}
              </div>
            </div>
          )}

          <MoveList moves={moves} currentIdx={currentIdx} onSelect={onMoveSelect} />

          {pieceActivity.length > 0 && (
            <PieceActivityPanel pieces={pieceActivity} />
          )}

          <SilmanPanel fen={currentFen} />
        </>
      )}

      {!isAnalyzing && moves.length === 0 && (
        <div style={styles.empty}>导入棋谱后开始分析</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10, width: 280, flexShrink: 0 },
  progressBar: { background: '#111827', borderRadius: 8, padding: 12, border: '1px solid #1f2937' },
  progressLabel: { fontSize: 12, color: '#81c995', marginBottom: 8, textAlign: 'center' },
  progressTrack: { height: 4, background: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#4b9e6b', borderRadius: 2, transition: 'width 0.3s' },
  moveInfo: { background: '#111827', borderRadius: 8, padding: 10, border: '1px solid #1f2937' },
  moveSan: { fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 6 },
  moveDetails: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  score: { fontSize: 13, fontWeight: 700, color: '#81c995' },
  errorBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 500 },
  bestMove: { fontSize: 11, color: '#6b7280', fontFamily: 'monospace' },
  empty: { color: '#4b5563', fontSize: 13, textAlign: 'center', padding: 24 },
};
