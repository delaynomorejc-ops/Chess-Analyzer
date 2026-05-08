import { useState } from 'react';
import { setApiKey, clearApiKey, hasApiKey, getProvider, setProvider } from '../lib/claude';
import type { AIProvider } from '../lib/claude';
import { exportAllData, importAllData } from '../db';

interface SettingsProps {
  onClose: () => void;
}

const PROVIDERS: { id: AIProvider; name: string; hint: string; keyHint: string }[] = [
  { id: 'deepseek', name: 'DeepSeek', hint: 'api.deepseek.com · deepseek-chat', keyHint: 'sk-...' },
  { id: 'anthropic', name: 'Claude (Anthropic)', hint: 'api.anthropic.com · claude-sonnet-4', keyHint: 'sk-ant-...' },
];

export function Settings({ onClose }: SettingsProps) {
  const [provider, setProviderState] = useState<AIProvider>(getProvider());
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(hasApiKey());
  const [msg, setMsg] = useState('');

  function handleProviderChange(p: AIProvider) {
    setProvider(p);
    setProviderState(p);
    setSaved(hasApiKey());
  }

  function handleSave() {
    if (!key.trim()) return;
    setApiKey(key);
    setSaved(true);
    setKey('');
    flash('API Key 已保存');
  }

  function handleClear() {
    clearApiKey();
    setSaved(false);
    flash('API Key 已清除');
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 2000);
  }

  async function handleExport() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-analyzer-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await importAllData(data);
      flash('数据导入成功');
    } catch {
      flash('导入失败：文件格式错误');
    }
  }

  const currentProvider = PROVIDERS.find(p => p.id === provider)!;

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>设置</h2>
          <button style={styles.close} onClick={onClose}>✕</button>
        </div>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>AI 服务商</h3>
          <div style={styles.providerRow}>
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                style={{ ...styles.providerBtn, ...(provider === p.id ? styles.providerBtnActive : {}) }}
                onClick={() => handleProviderChange(p.id)}
              >
                <span style={styles.providerName}>{p.name}</span>
                <span style={styles.providerHint}>{p.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>API Key</h3>
          <p style={styles.hint}>
            {currentProvider.name} 的 API Key，存储在浏览器本地，不会上传到任何服务器。
            {saved && <span style={styles.badge}>✓ 已配置</span>}
          </p>
          <div style={styles.row}>
            <input
              style={styles.input}
              type="password"
              placeholder={currentProvider.keyHint}
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <button style={styles.btn} onClick={handleSave}>保存</button>
            {saved && <button style={{ ...styles.btn, ...styles.dangerBtn }} onClick={handleClear}>清除</button>}
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>数据管理</h3>
          <div style={styles.row}>
            <button style={styles.btn} onClick={handleExport}>导出全部数据</button>
            <label style={{ ...styles.btn, cursor: 'pointer' }}>
              导入数据
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </label>
          </div>
        </section>

        {msg && <div style={styles.msg}>{msg}</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#1f2937', borderRadius: 12, padding: 28, width: 500, maxWidth: '92vw',
    border: '1px solid #374151',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 700, color: '#e5e7eb', margin: 0 },
  close: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer' },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: '#81c995', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  providerRow: { display: 'flex', gap: 8 },
  providerBtn: {
    flex: 1, background: '#111827', border: '1px solid #374151', borderRadius: 8,
    padding: '10px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3,
    textAlign: 'left',
  },
  providerBtnActive: { border: '1px solid #81c995', background: '#0d1f17' },
  providerName: { fontSize: 13, fontWeight: 600, color: '#e5e7eb' },
  providerHint: { fontSize: 10, color: '#6b7280' },
  hint: { fontSize: 12, color: '#9ca3af', marginBottom: 10, lineHeight: 1.6 },
  badge: { marginLeft: 8, background: '#1e3a2f', color: '#81c995', padding: '2px 8px', borderRadius: 12, fontSize: 11 },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, background: '#111827', border: '1px solid #374151', borderRadius: 6,
    padding: '8px 12px', color: '#e5e7eb', fontSize: 13,
  },
  btn: {
    background: '#374151', border: 'none', color: '#e5e7eb', padding: '8px 16px',
    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
  },
  dangerBtn: { background: '#7f1d1d', color: '#fca5a5' },
  msg: {
    marginTop: 8, padding: '8px 12px', background: '#1e3a2f', borderRadius: 6,
    color: '#81c995', fontSize: 13, textAlign: 'center',
  },
};
