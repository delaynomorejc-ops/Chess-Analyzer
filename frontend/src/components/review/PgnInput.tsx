import { useState, useRef } from 'react';
import { Chess } from 'chess.js';

interface PgnInputProps {
  onSubmit: (pgn: string, playerColor: 'white' | 'black') => void;
}

export function PgnInput({ onSubmit }: PgnInputProps) {
  const [pgn, setPgn] = useState('');
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (!pgn.trim()) { setError('请输入 PGN'); return; }
    const chess = new Chess();
    try {
      chess.loadPgn(pgn.trim());
    } catch {
      setError('PGN 格式错误，请检查后重试');
      return;
    }
    setError('');
    onSubmit(pgn.trim(), color);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPgn(text.trim());
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.title}>导入棋谱</span>
        <button style={styles.fileBtn} onClick={() => fileRef.current?.click()}>
          📂 上传 .pgn 文件
        </button>
        <input ref={fileRef} type="file" accept=".pgn" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      <textarea
        style={styles.textarea}
        value={pgn}
        onChange={e => setPgn(e.target.value)}
        placeholder={`粘贴 PGN 格式棋谱，例如：\n[Event "..."]\n[White "..."]\n[Black "..."]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 ...`}
        spellCheck={false}
      />

      <div style={styles.footer}>
        <div style={styles.colorSelect}>
          <span style={styles.label}>我执棋：</span>
          {(['white', 'black'] as const).map(c => (
            <button
              key={c}
              style={{ ...styles.colorBtn, ...(color === c ? styles.colorBtnActive : {}) }}
              onClick={() => setColor(c)}
            >
              {c === 'white' ? '⬜ 白棋' : '⬛ 黑棋'}
            </button>
          ))}
        </div>
        {error && <span style={styles.error}>{error}</span>}
        <button style={styles.submitBtn} onClick={handleSubmit}>开始分析 →</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontSize: 14, fontWeight: 600, color: '#e5e7eb', flex: 1 },
  fileBtn: {
    background: '#374151', border: 'none', color: '#d1d5db', padding: '6px 12px',
    borderRadius: 6, cursor: 'pointer', fontSize: 12,
  },
  textarea: {
    width: '100%', height: 200, background: '#111827', border: '1px solid #374151',
    borderRadius: 8, padding: 12, color: '#e5e7eb', fontSize: 12, fontFamily: 'monospace',
    resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
  },
  footer: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  colorSelect: { display: 'flex', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, color: '#9ca3af' },
  colorBtn: {
    background: '#1f2937', border: '1px solid #374151', color: '#9ca3af',
    padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  },
  colorBtnActive: { border: '1px solid #81c995', color: '#81c995', background: '#1e3a2f' },
  error: { fontSize: 12, color: '#f87171', flex: 1 },
  submitBtn: {
    marginLeft: 'auto', background: '#166534', border: 'none', color: '#bbf7d0',
    padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};
