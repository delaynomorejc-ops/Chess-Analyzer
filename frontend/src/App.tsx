import { useState } from 'react';
import { Nav } from './components/Nav';
import { Settings } from './components/Settings';
import { GameReview } from './components/review/GameReview';
import { Dashboard } from './components/dashboard/Dashboard';
import { TrainingPlan } from './components/plan/TrainingPlan';
import { OpeningLibrary } from './components/openings/OpeningLibrary';
import { FreePlay } from './components/FreePlay';
import type { AggregatedStats } from './types';

export type Tab = 'freeplay' | 'review' | 'dashboard' | 'plan' | 'openings';

export default function App() {
  const [tab, setTab] = useState<Tab>('freeplay');
  const [showSettings, setShowSettings] = useState(false);
  const [planStats, setPlanStats] = useState<AggregatedStats | null>(null);

  function handleGeneratePlan(stats: AggregatedStats) {
    setPlanStats(stats);
    setTab('plan');
  }

  return (
    <div style={styles.root}>
      <Nav active={tab} onChange={setTab} onSettings={() => setShowSettings(true)} />

      <main style={styles.main}>
        {tab === 'freeplay' && <FreePlay />}
        {tab === 'review' && <GameReview />}
        {tab === 'dashboard' && <Dashboard onGeneratePlan={handleGeneratePlan} />}
        {tab === 'plan' && <TrainingPlan preloadedStats={planStats} />}
        {tab === 'openings' && <OpeningLibrary />}
      </main>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#0f172a', color: '#e5e7eb' },
  main: { minHeight: 'calc(100vh - 52px)' },
};
