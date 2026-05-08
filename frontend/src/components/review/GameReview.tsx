import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { v4 as uuidv4 } from 'uuid';
import { PgnInput } from './PgnInput';
import { AnalysisPanel } from './AnalysisPanel';
import { EvalBar } from '../EvalBar';
import { useGameAnalysis } from '../../hooks/useGameAnalysis';
import {
  detectPhaseBoundaries, calcPhaseAcl, detectZombiePieces,
  detectPlanBreak, detectBlunders, extractEcoFromPgn, extractDateFromPgn,
  extractResultFromPgn, extractPlayersFromPgn, analyzePieceActivity,
} from '../../lib/analysis';
import { generateGameSummary, hasApiKey } from '../../lib/claude';
import { saveGame } from '../../db';
import type { GameSummary, PieceActivity } from '../../types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BOARD_WIDTH = 480;

export function GameReview() {
  const [pgn, setPgn] = useState('');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [positions, setPositions] = useState<Array<{ fen: string; san: string }>>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [pieceActivity, setPieceActivity] = useState<PieceActivity[]>([]);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [claudeSummary, setClaudeSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const { moves, progress, analyzeGame, reset } = useGameAnalysis();
  const isAnalyzing = !progress.done && progress.total > 0;

  function handleImport(newPgn: string, color: 'white' | 'black') {
    const chess = new Chess();
    chess.loadPgn(newPgn);
    const history = chess.history({ verbose: true });

    const posArr: Array<{ fen: string; san: string }> = [{ fen: START_FEN, san: '' }];
    const replay = new Chess();
    for (const m of history) {
      replay.move(m.san);
      posArr.push({ fen: replay.fen(), san: m.san });
    }

    setPgn(newPgn);
    setPlayerColor(color);
    setPositions(posArr);
    setCurrentIdx(0);
    setOrientation(color);
    setSummary(null);
    setClaudeSummary('');
    setSaved(false);
    reset();
    analyzeGame(newPgn, color);

    const activity = analyzePieceActivity(posArr, color);
    setPieceActivity(activity);
  }

  useEffect(() => {
    if (progress.done && moves.length > 0 && pgn) {
      buildSummary();
    }
  }, [progress.done]);

  async function buildSummary() {
    const { eco, opening } = extractEcoFromPgn(pgn);
    const date = extractDateFromPgn(pgn);
    const result = extractResultFromPgn(pgn);
    const { white, black } = extractPlayersFromPgn(pgn);
    const playerMoves = moves.filter(m => m.color === playerColor);
    const boundaries = detectPhaseBoundaries(positions.slice(1), );
    const phase_acl = calcPhaseAcl(playerMoves, boundaries);
    const zombies = detectZombiePieces(positions.slice(1), playerColor);
    const planBreak = detectPlanBreak(playerMoves);
    const blunders = detectBlunders(playerMoves);
    const scoreCurve = moves.map(m => m.score ?? 0);

    const gameSummary: GameSummary = {
      game_id: uuidv4(),
      date,
      result,
      eco,
      opening,
      player_color: playerColor,
      score_curve: scoreCurve,
      phase_acl,
      phase_boundaries: boundaries,
      blunders,
      zombie_pieces: zombies,
      plan_break_move: planBreak,
      novelty_point: null,
      endgame_result: null,
      opening_category_ids: [],
      pgn,
      claude_summary: null,
      white_player: white,
      black_player: black,
    };

    setSummary(gameSummary);

    if (hasApiKey()) {
      setSummaryLoading(true);
      try {
        const text = await generateGameSummary(gameSummary);
        gameSummary.claude_summary = text;
        setClaudeSummary(text);
      } catch (e) {
        console.warn('Claude summary failed:', e);
      }
      setSummaryLoading(false);
    }
  }

  async function handleSave() {
    if (!summary) return;
    const toSave = { ...summary, claude_summary: claudeSummary || summary.claude_summary };
    await saveGame(toSave);
    setSaved(true);
  }

  const currentFen = positions[currentIdx + 1]?.fen ?? START_FEN;
  const currentScore = currentIdx >= 0 ? (moves[currentIdx]?.score ?? null) : null;

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowRight') setCurrentIdx(i => Math.min(i + 1, positions.length - 2));
    if (e.key === 'ArrowLeft') setCurrentIdx(i => Math.max(i - 1, -1));
  }, [positions.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div style={styles.wrap}>
      {positions.length === 0 ? (
        <div style={styles.inputWrap}>
          <PgnInput onSubmit={handleImport} />
        </div>
      ) : (
        <div style={styles.reviewLayout}>
          {/* Board area */}
          <div style={styles.boardArea}>
            <div style={styles.gameInfo}>
              <span style={styles.players}>
                {extractPlayersFromPgn(pgn).white} vs {extractPlayersFromPgn(pgn).black}
              </span>
              <span style={styles.result}>{extractResultFromPgn(pgn)}</span>
              <button style={styles.newGameBtn} onClick={() => { setPositions([]); reset(); }}>
                ← 换棋谱
              </button>
            </div>

            <div style={styles.boardRow}>
              <EvalBar score={currentScore} height={BOARD_WIDTH} />
              <Chessboard
                position={currentFen}
                boardWidth={BOARD_WIDTH}
                boardOrientation={orientation}
                arePiecesDraggable={false}
                customDarkSquareStyle={{ backgroundColor: '#779952' }}
                customLightSquareStyle={{ backgroundColor: '#edeed1' }}
              />
            </div>

            <div style={styles.controls}>
              <button style={styles.btn} onClick={() => setCurrentIdx(-1)}>⏮</button>
              <button style={styles.btn} onClick={() => setCurrentIdx(i => Math.max(i - 1, -1))}>◀</button>
              <span style={styles.moveNum}>
                {currentIdx >= 0 ? `${moves[currentIdx]?.moveNumber ?? ''}${moves[currentIdx]?.color === 'black' ? '...' : '.'}${moves[currentIdx]?.san ?? ''}` : '开始局面'}
              </span>
              <button style={styles.btn} onClick={() => setCurrentIdx(i => Math.min(i + 1, positions.length - 2))}>▶</button>
              <button style={styles.btn} onClick={() => setCurrentIdx(positions.length - 2)}>⏭</button>
              <button style={{ ...styles.btn, marginLeft: 12 }} onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')}>⇅</button>
            </div>

            {summary && (
              <div style={styles.summaryBox}>
                <div style={styles.summaryStats}>
                  <Stat label="开局 ACL" value={`${summary.phase_acl.opening}cp`} />
                  <Stat label="中局 ACL" value={`${summary.phase_acl.middlegame}cp`} />
                  <Stat label="残局 ACL" value={`${summary.phase_acl.endgame}cp`} />
                  <Stat label="决定性失误" value={`${summary.blunders.filter(b => b.magnitude >= 500).length}个`} warn={summary.blunders.filter(b => b.magnitude >= 500).length > 0} />
                  <Stat label="僵尸棋子" value={`${summary.zombie_pieces.length}个`} warn={summary.zombie_pieces.length > 0} />
                </div>
                {summaryLoading && <div style={styles.claudeLoading}>Claude 生成总结中...</div>}
                {claudeSummary && (
                  <div style={styles.claudeSummary}>
                    <span style={styles.claudeLabel}>教练点评</span>
                    <p style={styles.claudeText}>{claudeSummary}</p>
                  </div>
                )}
                {!saved ? (
                  <button style={styles.saveBtn} onClick={handleSave}>保存到历史记录</button>
                ) : (
                  <span style={styles.savedBadge}>✓ 已保存</span>
                )}
              </div>
            )}
          </div>

          {/* Analysis panel */}
          <AnalysisPanel
            moves={moves}
            currentIdx={currentIdx}
            currentFen={currentFen}
            playerColor={playerColor}
            pieceActivity={pieceActivity}
            isAnalyzing={isAnalyzing}
            progress={progress}
            onMoveSelect={setCurrentIdx}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={statStyles.wrap}>
      <span style={statStyles.label}>{label}</span>
      <span style={{ ...statStyles.value, color: warn ? '#f87171' : '#81c995' }}>{value}</span>
    </div>
  );
}

const statStyles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  label: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: 700 },
};

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '20px 24px', minHeight: 'calc(100vh - 52px)' },
  inputWrap: { maxWidth: 640, margin: '40px auto' },
  reviewLayout: { display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' },
  boardArea: { display: 'flex', flexDirection: 'column', gap: 12 },
  gameInfo: { display: 'flex', alignItems: 'center', gap: 12 },
  players: { fontSize: 13, color: '#d1d5db', fontWeight: 500 },
  result: { fontSize: 13, color: '#81c995', fontWeight: 700 },
  newGameBtn: { marginLeft: 'auto', background: 'transparent', border: '1px solid #374151', color: '#9ca3af', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  boardRow: { display: 'flex', alignItems: 'stretch', gap: 8 },
  controls: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btn: {
    background: '#1f2937', border: '1px solid #374151', color: '#9ca3af',
    width: 34, height: 34, borderRadius: 6, cursor: 'pointer', fontSize: 14,
  },
  moveNum: { fontSize: 13, color: '#d1d5db', minWidth: 120, textAlign: 'center', fontFamily: 'monospace' },
  summaryBox: { background: '#111827', borderRadius: 8, padding: 16, border: '1px solid #1f2937' },
  summaryStats: { display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 12 },
  claudeLoading: { fontSize: 12, color: '#6b7280', textAlign: 'center', padding: '8px 0' },
  claudeSummary: { marginBottom: 12 },
  claudeLabel: { fontSize: 11, color: '#81c995', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 },
  claudeText: { fontSize: 13, color: '#d1d5db', lineHeight: 1.7, marginTop: 4 },
  saveBtn: {
    display: 'block', width: '100%', background: '#166534', border: 'none', color: '#bbf7d0',
    padding: '8px 0', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  savedBadge: { display: 'block', textAlign: 'center', fontSize: 13, color: '#81c995', padding: '8px 0' },
};
