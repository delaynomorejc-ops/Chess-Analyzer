import { useState, useEffect } from 'react';
import { generateTrainingPlan, hasApiKey } from '../../lib/claude';
import { saveTrainingPlan, getAllTrainingPlans } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import type { AggregatedStats, TrainingPlan as TPlan } from '../../types';

interface TrainingPlanProps {
  preloadedStats?: AggregatedStats | null;
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul]|<\/[hul]|<li|<\/li|<p|<\/p)(.+)$/gm, '<p>$1</p>');
}

export function TrainingPlan({ preloadedStats }: TrainingPlanProps) {
  const [days, setDays] = useState('30');
  const [hours, setHours] = useState('6');
  const [minutes, setMinutes] = useState('60');
  const [hasCoach, setHasCoach] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState('');
  const [history, setHistory] = useState<TPlan[]>([]);
  const [viewingPlan, setViewingPlan] = useState<TPlan | null>(null);

  useEffect(() => {
    getAllTrainingPlans().then(setHistory);
  }, []);

  async function handleGenerate() {
    if (!preloadedStats) {
      setError('请先在「多局分析」页面生成聚合数据（至少3局）');
      return;
    }
    if (!hasApiKey()) {
      setError('请先在设置中配置 Claude API Key');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const content = await generateTrainingPlan(preloadedStats, {
        days_to_tournament: parseInt(days) || 30,
        weekly_hours: parseFloat(hours) || 6,
        session_minutes: parseInt(minutes) || 60,
        has_coach: hasCoach,
      });
      setPlan(content);

      const newPlan: TPlan = {
        id: uuidv4(),
        created_at: new Date().toISOString(),
        days_to_tournament: parseInt(days) || 30,
        weekly_hours: parseFloat(hours) || 6,
        session_minutes: parseInt(minutes) || 60,
        has_coach: hasCoach,
        content,
        games_count: preloadedStats.total_games,
      };
      await saveTrainingPlan(newPlan);
      setHistory(h => [newPlan, ...h]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败，请检查 API Key 是否有效');
    }
    setLoading(false);
  }

  function handleExportPdf() {
    window.print();
  }

  if (viewingPlan) {
    return (
      <div style={styles.wrap}>
        <div style={styles.topBar}>
          <button style={styles.backBtn} onClick={() => setViewingPlan(null)}>← 返回</button>
          <span style={styles.histDate}>{new Date(viewingPlan.created_at).toLocaleDateString('zh-CN')}</span>
          <button style={styles.pdfBtn} onClick={handleExportPdf}>打印 / 导出 PDF</button>
        </div>
        <div style={styles.planContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(viewingPlan.content) }} />
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <h2 style={styles.title}>备赛训练计划</h2>
        {plan && <button style={styles.pdfBtn} onClick={handleExportPdf}>打印 / 导出 PDF</button>}
      </div>

      <div style={styles.layout}>
        <div style={styles.formCard}>
          <h3 style={styles.sectionTitle}>备赛参数</h3>
          <FormRow label="距比赛天数">
            <input style={styles.input} type="number" value={days} onChange={e => setDays(e.target.value)} min="7" max="180" />
            <span style={styles.unit}>天</span>
          </FormRow>
          <FormRow label="每周可用时间">
            <input style={styles.input} type="number" value={hours} onChange={e => setHours(e.target.value)} min="1" max="40" step="0.5" />
            <span style={styles.unit}>小时</span>
          </FormRow>
          <FormRow label="每次训练时长">
            <input style={styles.input} type="number" value={minutes} onChange={e => setMinutes(e.target.value)} min="20" max="180" step="5" />
            <span style={styles.unit}>分钟</span>
          </FormRow>
          <FormRow label="有专业教练">
            <button
              style={{ ...styles.toggleBtn, ...(hasCoach ? styles.toggleOn : {}) }}
              onClick={() => setHasCoach(v => !v)}
            >
              {hasCoach ? '是' : '否'}
            </button>
          </FormRow>

          {preloadedStats && (
            <div style={styles.statsHint}>
              基于 {preloadedStats.total_games} 局对局数据 · {preloadedStats.date_range}
            </div>
          )}
          {!preloadedStats && (
            <div style={styles.noData}>请先在「多局分析」页面积累至少 3 局对局</div>
          )}

          {error && <div style={styles.error}>{error}</div>}

          <button
            style={{ ...styles.generateBtn, ...(loading ? styles.generateBtnDisabled : {}) }}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? '⏳ Claude 生成中...' : '生成训练计划'}
          </button>
        </div>

        <div style={styles.rightPanel}>
          {plan ? (
            <div style={styles.planCard}>
              <div style={styles.planHeader}>
                <span style={styles.planTitle}>训练计划</span>
                <button style={styles.pdfBtn} onClick={handleExportPdf}>打印</button>
              </div>
              <div style={styles.planContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(plan) }} />
            </div>
          ) : (
            <div>
              {history.length > 0 && (
                <div style={styles.historyCard}>
                  <h3 style={styles.sectionTitle}>历史计划</h3>
                  {history.map(p => (
                    <div key={p.id} style={styles.histItem} onClick={() => setViewingPlan(p)}>
                      <span style={styles.histDate}>{new Date(p.created_at).toLocaleDateString('zh-CN')}</span>
                      <span style={styles.histInfo}>
                        {p.days_to_tournament}天 · {p.games_count}局数据
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <label style={{ fontSize: 13, color: '#9ca3af', width: 100 }}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '20px 24px' },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700, color: '#e5e7eb', margin: 0, flex: 1 },
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  formCard: {
    background: '#111827', borderRadius: 10, padding: 20, border: '1px solid #1f2937',
    width: 300, flexShrink: 0,
  },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#81c995', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  input: {
    width: 80, background: '#1f2937', border: '1px solid #374151', borderRadius: 6,
    padding: '6px 10px', color: '#e5e7eb', fontSize: 13, textAlign: 'right',
  },
  unit: { fontSize: 12, color: '#6b7280' },
  toggleBtn: {
    background: '#374151', border: 'none', color: '#9ca3af', padding: '6px 16px',
    borderRadius: 6, cursor: 'pointer', fontSize: 13,
  },
  toggleOn: { background: '#1e3a2f', color: '#81c995' },
  statsHint: { fontSize: 12, color: '#4b9e6b', marginBottom: 12, padding: '6px 10px', background: '#0d1f17', borderRadius: 6 },
  noData: { fontSize: 12, color: '#6b7280', marginBottom: 12, padding: '6px 10px', background: '#1f2937', borderRadius: 6 },
  error: { fontSize: 12, color: '#f87171', marginBottom: 12, padding: '6px 10px', background: '#1c0e0e', borderRadius: 6 },
  generateBtn: {
    width: '100%', background: '#166534', border: 'none', color: '#bbf7d0',
    padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  generateBtnDisabled: { background: '#374151', color: '#6b7280', cursor: 'not-allowed' },
  rightPanel: { flex: 1, minWidth: 0 },
  planCard: { background: '#111827', borderRadius: 10, padding: 20, border: '1px solid #1f2937' },
  planHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  planTitle: { fontSize: 14, fontWeight: 600, color: '#e5e7eb' },
  pdfBtn: {
    background: '#374151', border: 'none', color: '#d1d5db',
    padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  },
  backBtn: {
    background: 'transparent', border: 'none', color: '#9ca3af',
    padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
  },
  planContent: {
    fontSize: 13, color: '#d1d5db', lineHeight: 1.8,
    maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
  },
  historyCard: { background: '#111827', borderRadius: 10, padding: 16, border: '1px solid #1f2937' },
  histItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid #1f2937', cursor: 'pointer',
  },
  histDate: { fontSize: 13, color: '#9ca3af' },
  histInfo: { fontSize: 12, color: '#6b7280' },
};
