import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
} from 'recharts';
import { getAllGames } from '../../db';
import type { GameSummary, AggregatedStats, TrendLabel } from '../../types';

function aggregateGames(games: GameSummary[]): AggregatedStats {
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));

  const errorTrend = { tactical: [] as number[], strategic: [] as number[], psychological: [] as number[] };
  const zombieRates: number[] = [];
  const planBreaks: (number | null)[] = [];
  const phaseAclPerGame: { opening: number; middlegame: number; endgame: number }[] = [];

  for (const g of sorted) {
    errorTrend.tactical.push(g.blunders.filter(b => b.type === '战术').length);
    errorTrend.strategic.push(g.blunders.filter(b => b.type === '战略').length);
    errorTrend.psychological.push(g.blunders.filter(b => b.type === '心理').length);
    zombieRates.push(g.zombie_pieces.length);
    planBreaks.push(g.plan_break_move);
    phaseAclPerGame.push(g.phase_acl);
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const trendLabel = (arr: number[]): TrendLabel => {
    if (arr.length < 3) return '稳定';
    const last3 = arr.slice(-3);
    const prev3 = arr.slice(-6, -3);
    const avgLast = avg(last3);
    const avgPrev = prev3.length > 0 ? avg(prev3) : avgLast;
    const allHigh = arr.slice(-3).every(v => v >= 3);
    if (allHigh) return '系统性弱点';
    if (avgLast < avgPrev * 0.7) return '改善中';
    const variance = Math.max(...arr) - Math.min(...arr);
    if (variance > avg(arr) * 0.8) return '不稳定';
    return '稳定';
  };

  // Opening stats by ECO
  const openingStats: Record<string, { games: number; wins: number; draws: number; losses: number; totalAclOpening: number; totalNovelty: number }> = {};
  for (const g of sorted) {
    const eco = g.eco || '?';
    if (!openingStats[eco]) openingStats[eco] = { games: 0, wins: 0, draws: 0, losses: 0, totalAclOpening: 0, totalNovelty: 0 };
    openingStats[eco].games++;
    if (g.result === '1-0' && g.player_color === 'white') openingStats[eco].wins++;
    else if (g.result === '0-1' && g.player_color === 'black') openingStats[eco].wins++;
    else if (g.result === '1/2-1/2') openingStats[eco].draws++;
    else openingStats[eco].losses++;
    openingStats[eco].totalAclOpening += g.phase_acl.opening;
    if (g.novelty_point) openingStats[eco].totalNovelty += g.novelty_point;
  }

  const openingStatsOut: AggregatedStats['opening_stats'] = {};
  const weakest: { eco: string; winRate: number }[] = [];
  for (const [eco, s] of Object.entries(openingStats)) {
    const wr = s.games > 0 ? (s.wins + s.draws * 0.5) / s.games : 0;
    openingStatsOut[eco] = {
      games: s.games,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      win_rate: parseFloat(wr.toFixed(2)),
      avg_acl_opening: s.games > 0 ? Math.round(s.totalAclOpening / s.games) : 0,
      avg_novelty_move: s.games > 0 ? Math.round(s.totalNovelty / s.games) : 0,
      trend: '稳定',
    };
    if (s.games >= 2) weakest.push({ eco, winRate: wr });
  }
  weakest.sort((a, b) => a.winRate - b.winRate);

  const dates = sorted.map(g => g.date);
  const dateRange = dates.length > 0 ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '—';

  return {
    total_games: sorted.length,
    date_range: dateRange,
    error_type_trend: errorTrend,
    phase_acl_avg: {
      opening: avg(phaseAclPerGame.map(p => p.opening)),
      middlegame: avg(phaseAclPerGame.map(p => p.middlegame)),
      endgame: avg(phaseAclPerGame.map(p => p.endgame)),
    },
    phase_acl_per_game: phaseAclPerGame,
    zombie_rate_per_game: zombieRates,
    plan_break_per_game: planBreaks,
    indicator_trends: {
      zombie_piece_rate: trendLabel(zombieRates),
      plan_break_move: trendLabel(planBreaks.map(p => p ?? 0)),
      tactical_errors: trendLabel(errorTrend.tactical),
      strategic_errors: trendLabel(errorTrend.strategic),
      psychological_errors: trendLabel(errorTrend.psychological),
    },
    opening_stats: openingStatsOut,
    weakest_openings: weakest.slice(0, 3).map(w => w.eco),
  };
}

const TREND_COLOR: Record<TrendLabel, string> = {
  '系统性弱点': '#ef4444',
  '不稳定': '#f97316',
  '改善中': '#81c995',
  '稳定': '#6b7280',
};

interface DashboardProps {
  onGeneratePlan: (stats: AggregatedStats) => void;
}

export function Dashboard({ onGeneratePlan }: DashboardProps) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllGames().then(g => { setGames(g); setLoading(false); });
  }, []);

  if (loading) return <div style={styles.empty}>加载中...</div>;

  if (games.length < 3) {
    return (
      <div style={styles.empty}>
        <p style={{ fontSize: 16, color: '#d1d5db', marginBottom: 8 }}>至少需要 3 局对局才能开启多局分析</p>
        <p style={{ fontSize: 13, color: '#6b7280' }}>当前已有 {games.length} 局，请先在「单盘复盘」中分析并保存对局。</p>
      </div>
    );
  }

  const stats = aggregateGames(games);
  const n = stats.total_games;
  const labels = Array.from({ length: n }, (_, i) => `G${i + 1}`);

  const errorData = labels.map((l, i) => ({
    name: l,
    战术: stats.error_type_trend.tactical[i] ?? 0,
    战略: stats.error_type_trend.strategic[i] ?? 0,
    心理: stats.error_type_trend.psychological[i] ?? 0,
  }));

  const aclData = labels.map((l, i) => ({
    name: l,
    开局: stats.phase_acl_per_game[i]?.opening ?? 0,
    中局: stats.phase_acl_per_game[i]?.middlegame ?? 0,
    残局: stats.phase_acl_per_game[i]?.endgame ?? 0,
  }));

  const aclAvgData = [
    { name: '开局', value: stats.phase_acl_avg.opening },
    { name: '中局', value: stats.phase_acl_avg.middlegame },
    { name: '残局', value: stats.phase_acl_avg.endgame },
  ];

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.pageTitle}>多局综合分析</h2>
          <p style={styles.subtitle}>{stats.date_range} · {stats.total_games} 局</p>
        </div>
        <button style={styles.planBtn} onClick={() => onGeneratePlan(stats)}>
          生成训练计划 →
        </button>
      </div>

      {/* Indicator trend badges */}
      <div style={styles.trendGrid}>
        {(Object.entries(stats.indicator_trends) as [string, TrendLabel][]).map(([key, label]) => (
          <div key={key} style={{ ...styles.trendCard, borderColor: TREND_COLOR[label] + '60' }}>
            <span style={styles.trendKey}>{TREND_KEYS[key as keyof typeof TREND_KEYS] ?? key}</span>
            <span style={{ ...styles.trendLabel, color: TREND_COLOR[label] }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={styles.chartsGrid}>
        {/* Error type trend */}
        <ChartCard title="失误类型趋势">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={errorData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="战术" stackId="a" fill="#ef4444" />
              <Bar dataKey="战略" stackId="a" fill="#f97316" />
              <Bar dataKey="心理" stackId="a" fill="#a855f7" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Phase ACL per game */}
        <ChartCard title="各阶段失分趋势（cp）">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={aclData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="开局" stroke="#81c995" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="中局" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="残局" stroke="#f87171" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Average ACL comparison */}
        <ChartCard title="三段平均 ACL 对比">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={aclAvgData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 11 }} formatter={(v: unknown) => [`${v} cp`]} />
              <Bar dataKey="value" name="平均ACL" fill="#4b9e6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Opening stats */}
        <ChartCard title="开局库统计">
          <div style={styles.openingTable}>
            <div style={styles.tableHeader}>
              <span>开局</span><span>局数</span><span>胜率</span><span>开局ACL</span>
            </div>
            {Object.entries(stats.opening_stats).map(([eco, s]) => (
              <div key={eco} style={styles.tableRow}>
                <span style={{ color: '#d1d5db' }}>{eco}</span>
                <span>{s.games}</span>
                <span style={{ color: s.win_rate >= 0.5 ? '#81c995' : '#f87171' }}>
                  {(s.win_rate * 100).toFixed(0)}%
                </span>
                <span>{s.avg_acl_opening}cp</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

const TREND_KEYS = {
  zombie_piece_rate: '僵尸棋子',
  plan_break_move: '计划断裂',
  tactical_errors: '战术失误',
  strategic_errors: '战略失误',
  psychological_errors: '心理失误',
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyles.card}>
      <div style={cardStyles.title}>{title}</div>
      {children}
    </div>
  );
}

const cardStyles: Record<string, React.CSSProperties> = {
  card: { background: '#111827', borderRadius: 10, padding: '14px 12px', border: '1px solid #1f2937' },
  title: { fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
};

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '20px 24px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 52px)', gap: 8, textAlign: 'center' },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontSize: 20, fontWeight: 700, color: '#e5e7eb', margin: 0 },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  planBtn: {
    background: '#166534', border: 'none', color: '#bbf7d0', padding: '10px 20px',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  trendGrid: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  trendCard: {
    background: '#111827', border: '1px solid', borderRadius: 8,
    padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100,
  },
  trendKey: { fontSize: 11, color: '#9ca3af' },
  trendLabel: { fontSize: 13, fontWeight: 700 },
  chartsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  openingTable: { fontSize: 12 },
  tableHeader: { display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, padding: '4px 0', borderBottom: '1px solid #1f2937', color: '#6b7280', marginBottom: 4, fontSize: 10, textTransform: 'uppercase' },
  tableRow: { display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, padding: '5px 0', borderBottom: '1px solid #111827', color: '#9ca3af' },
};
