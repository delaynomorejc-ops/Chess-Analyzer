import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { v4 as uuidv4 } from 'uuid';
import { getAllOpeningCategories, saveOpeningCategory, deleteOpeningCategory, getAllGames } from '../../db';
import { matchOpeningCategory } from '../../lib/analysis';
import type { OpeningCategory, GameSummary } from '../../types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function OpeningLibrary() {
  const [categories, setCategories] = useState<OpeningCategory[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [editing, setEditing] = useState<OpeningCategory | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    Promise.all([getAllOpeningCategories(), getAllGames()]).then(([cats, gs]) => {
      setCategories(cats);
      setGames(gs);
    });
  }, []);

  async function handleSave(cat: OpeningCategory) {
    await saveOpeningCategory(cat);
    const updated = await getAllOpeningCategories();
    setCategories(updated);
    setShowEditor(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await deleteOpeningCategory(id);
    setCategories(c => c.filter(x => x.id !== id));
  }

  function matchCount(cat: OpeningCategory) {
    return games.filter(g => {
      if (cat.color !== 'both' && g.player_color !== cat.color) return false;
      return matchOpeningCategory(g.pgn, cat.moves);
    }).length;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <h2 style={styles.title}>开局分类库</h2>
        <button style={styles.addBtn} onClick={() => { setEditing(null); setShowEditor(true); }}>
          + 新建分类
        </button>
      </div>

      {categories.length === 0 && !showEditor && (
        <div style={styles.empty}>
          <p style={{ color: '#d1d5db', marginBottom: 8 }}>尚未创建任何开局分类</p>
          <p style={{ color: '#6b7280', fontSize: 13 }}>通过在棋盘上走出前几步来定义分类，系统会自动匹配历史对局。</p>
        </div>
      )}

      <div style={styles.grid}>
        {categories.map(cat => {
          const count = matchCount(cat);
          const matched = games.filter(g => {
            if (cat.color !== 'both' && g.player_color !== cat.color) return false;
            return matchOpeningCategory(g.pgn, cat.moves);
          });
          const wins = matched.filter(g =>
            (g.result === '1-0' && g.player_color === 'white') ||
            (g.result === '0-1' && g.player_color === 'black')
          ).length;
          const draws = matched.filter(g => g.result === '1/2-1/2').length;
          const winRate = count > 0 ? ((wins + draws * 0.5) / count * 100).toFixed(0) : '—';
          const avgAcl = count > 0
            ? Math.round(matched.reduce((s, g) => s + g.phase_acl.opening, 0) / count)
            : 0;

          return (
            <div key={cat.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.catName}>{cat.name}</span>
                <span style={styles.colorBadge}>
                  {cat.color === 'white' ? '⬜ 执白' : cat.color === 'black' ? '⬛ 执黑' : '双色'}
                </span>
              </div>
              <div style={styles.moveLine}>{cat.moves.slice(0, 6).join(' ')}{cat.moves.length > 6 ? '...' : ''}</div>
              <div style={styles.stats}>
                <span>{count} 局</span>
                <span style={{ color: parseFloat(winRate) >= 50 ? '#81c995' : '#f87171' }}>胜率 {winRate}%</span>
                <span>开局 ACL {avgAcl}cp</span>
              </div>
              <div style={styles.cardActions}>
                <button style={styles.editBtn} onClick={() => { setEditing(cat); setShowEditor(true); }}>编辑</button>
                <button style={styles.delBtn} onClick={() => handleDelete(cat.id)}>删除</button>
              </div>
            </div>
          );
        })}
      </div>

      {showEditor && (
        <CategoryEditor
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

interface CategoryEditorProps {
  initial: OpeningCategory | null;
  onSave: (cat: OpeningCategory) => void;
  onCancel: () => void;
}

function CategoryEditor({ initial, onSave, onCancel }: CategoryEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<'white' | 'black' | 'both'>(initial?.color ?? 'white');
  const [error, setError] = useState('');

  const [boardChess] = useState(() => {
    const c = new Chess();
    if (initial?.moves) {
      for (const m of initial.moves) {
        try { c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: 'q' }); } catch { break; }
      }
    }
    return c;
  });
  const [boardFen, setBoardFen] = useState(boardChess.fen());
  const [boardMoves, setBoardMoves] = useState<string[]>(initial?.moves ?? []);

  function onPieceDrop(from: string, to: string): boolean {
    try {
      const m = boardChess.move({ from, to, promotion: 'q' });
      if (!m) return false;
      const newMoves = [...boardMoves, from + to];
      setBoardMoves(newMoves);
      setBoardFen(boardChess.fen());
      return true;
    } catch { return false; }
  }

  function handleUndo() {
    boardChess.undo();
    setBoardMoves(m => m.slice(0, -1));
    setBoardFen(boardChess.fen());
  }

  function handleReset() {
    while (boardChess.history().length > 0) boardChess.undo();
    setBoardMoves([]);
    setBoardFen(START_FEN);
  }

  function handleSave() {
    if (!name.trim()) { setError('请输入分类名称'); return; }
    if (boardMoves.length === 0) { setError('请在棋盘上走出至少一步棋来定义分类'); return; }
    onSave({
      id: initial?.id ?? uuidv4(),
      name: name.trim(),
      color,
      moves: boardMoves,
      parent_id: initial?.parent_id ?? null,
      created_at: initial?.created_at ?? new Date().toISOString(),
    });
  }

  return (
    <div style={editorStyles.overlay} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={editorStyles.modal}>
        <h3 style={editorStyles.title}>{initial ? '编辑分类' : '新建开局分类'}</h3>

        <div style={editorStyles.row}>
          <input
            style={editorStyles.input}
            placeholder="分类名称（如：西班牙开局）"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <div style={editorStyles.colorBtns}>
            {(['white', 'black', 'both'] as const).map(c => (
              <button
                key={c}
                style={{ ...editorStyles.colorBtn, ...(color === c ? editorStyles.colorBtnActive : {}) }}
                onClick={() => setColor(c)}
              >
                {c === 'white' ? '⬜白' : c === 'black' ? '⬛黑' : '双色'}
              </button>
            ))}
          </div>
        </div>

        <p style={editorStyles.hint}>在棋盘上走出前几步来定义此分类（已走 {boardMoves.length} 步）</p>

        <div style={editorStyles.boardWrap}>
          <Chessboard
            position={boardFen}
            boardWidth={300}
            onPieceDrop={onPieceDrop}
            customDarkSquareStyle={{ backgroundColor: '#779952' }}
            customLightSquareStyle={{ backgroundColor: '#edeed1' }}
          />
          <div style={editorStyles.boardControls}>
            <div style={editorStyles.moveList}>
              {boardMoves.map((m, i) => <span key={i} style={editorStyles.moveChip}>{m}</span>)}
            </div>
            <div style={editorStyles.btnRow}>
              <button style={editorStyles.btn} onClick={handleUndo} disabled={boardMoves.length === 0}>撤销</button>
              <button style={editorStyles.btn} onClick={handleReset}>清空</button>
            </div>
          </div>
        </div>

        {error && <p style={editorStyles.error}>{error}</p>}

        <div style={editorStyles.actions}>
          <button style={editorStyles.cancelBtn} onClick={onCancel}>取消</button>
          <button style={editorStyles.saveBtn} onClick={handleSave}>保存分类</button>
        </div>
      </div>
    </div>
  );
}

const editorStyles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#1f2937', borderRadius: 12, padding: 24, width: 640, maxWidth: '95vw', border: '1px solid #374151' },
  title: { fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 },
  row: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 },
  input: { flex: 1, background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', color: '#e5e7eb', fontSize: 13 },
  colorBtns: { display: 'flex', gap: 4 },
  colorBtn: { background: '#374151', border: '1px solid #374151', color: '#9ca3af', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  colorBtnActive: { border: '1px solid #81c995', color: '#81c995', background: '#1e3a2f' },
  hint: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  boardWrap: { display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12 },
  boardControls: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  moveList: { display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 32 },
  moveChip: { background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#d1d5db', fontFamily: 'monospace' },
  btnRow: { display: 'flex', gap: 6 },
  btn: { background: '#374151', border: 'none', color: '#d1d5db', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  error: { fontSize: 12, color: '#f87171', marginBottom: 8 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: { background: '#374151', border: 'none', color: '#d1d5db', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  saveBtn: { background: '#166534', border: 'none', color: '#bbf7d0', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '20px 24px' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: '#e5e7eb', margin: 0 },
  addBtn: { background: '#166534', border: 'none', color: '#bbf7d0', padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 8, textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  card: { background: '#111827', borderRadius: 10, padding: 16, border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: 8 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  catName: { fontSize: 14, fontWeight: 600, color: '#e5e7eb' },
  colorBadge: { fontSize: 11, color: '#6b7280' },
  moveLine: { fontSize: 11, color: '#4b5563', fontFamily: 'monospace' },
  stats: { display: 'flex', gap: 10, fontSize: 12, color: '#9ca3af' },
  cardActions: { display: 'flex', gap: 6, marginTop: 4 },
  editBtn: { background: '#374151', border: 'none', color: '#d1d5db', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  delBtn: { background: '#7f1d1d', border: 'none', color: '#fca5a5', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
};
