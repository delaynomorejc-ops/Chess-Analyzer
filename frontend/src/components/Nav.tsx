import type { Tab } from '../App';

interface NavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  onSettings: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'freeplay', label: '图片识别' },
  { id: 'review', label: '单盘复盘' },
  { id: 'dashboard', label: '多局分析' },
  { id: 'plan', label: '训练计划' },
  { id: 'openings', label: '开局分类库' },
];

export function Nav({ active, onChange, onSettings }: NavProps) {
  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <span style={styles.logo}>♟ Chess Analyzer</span>
        <div style={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              style={{ ...styles.tab, ...(active === t.id ? styles.tabActive : {}) }}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <button style={styles.settingsBtn} onClick={onSettings} title="设置">
        ⚙ 设置
      </button>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: 52,
    background: '#111827',
    borderBottom: '1px solid #2d3748',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: { display: 'flex', alignItems: 'center', gap: 32 },
  logo: { fontSize: 16, fontWeight: 700, color: '#81c995', letterSpacing: 1 },
  tabs: { display: 'flex', gap: 4 },
  tab: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  tabActive: { background: '#1e3a2f', color: '#81c995' },
  settingsBtn: {
    background: 'transparent',
    border: '1px solid #374151',
    color: '#9ca3af',
    padding: '5px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
};
