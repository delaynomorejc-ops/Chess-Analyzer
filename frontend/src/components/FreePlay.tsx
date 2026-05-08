import { useState } from 'react';
import { ImageUpload } from './ImageUpload';
import { ChessGame } from './ChessGame';

export function FreePlay() {
  const [fen, setFen] = useState<string | undefined>();

  return (
    <div style={styles.root}>
      <div style={styles.layout}>
        <div style={styles.left}>
          <ImageUpload onFenReady={setFen} />
          {fen && (
            <div style={styles.fenBox}>
              <p style={styles.fenLabel}>FEN</p>
              <code style={styles.fenCode}>{fen}</code>
            </div>
          )}
        </div>
        <ChessGame initialFen={fen} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { padding: '28px 32px', maxWidth: 1100, margin: '0 auto' },
  layout: {
    display: 'flex', gap: 40, justifyContent: 'center',
    alignItems: 'flex-start', flexWrap: 'wrap',
  },
  left: {
    display: 'flex', flexDirection: 'column', gap: 16,
    width: 240, paddingTop: 32,
  },
  fenBox: { background: '#0d1117', borderRadius: 8, padding: '10px 12px' },
  fenLabel: { margin: '0 0 4px', fontSize: 10, color: '#445', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  fenCode: { fontSize: 10, color: '#4a7', wordBreak: 'break-all', lineHeight: 1.7, fontFamily: 'monospace' },
};
