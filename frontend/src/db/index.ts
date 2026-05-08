import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GameSummary, OpeningCategory, TrainingPlan } from '../types';

interface ChessDB extends DBSchema {
  games: {
    key: string;
    value: GameSummary;
    indexes: { by_date: string };
  };
  opening_categories: {
    key: string;
    value: OpeningCategory;
  };
  training_plans: {
    key: string;
    value: TrainingPlan;
    indexes: { by_date: string };
  };
}

let dbPromise: Promise<IDBPDatabase<ChessDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ChessDB>('chess-analyzer', 1, {
      upgrade(db) {
        const games = db.createObjectStore('games', { keyPath: 'game_id' });
        games.createIndex('by_date', 'date');

        db.createObjectStore('opening_categories', { keyPath: 'id' });

        const plans = db.createObjectStore('training_plans', { keyPath: 'id' });
        plans.createIndex('by_date', 'created_at');
      },
    });
  }
  return dbPromise;
}

export async function saveGame(game: GameSummary) {
  const db = await getDB();
  await db.put('games', game);
}

export async function getGame(id: string) {
  const db = await getDB();
  return db.get('games', id);
}

export async function getAllGames(): Promise<GameSummary[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('games', 'by_date');
  return all.reverse();
}

export async function deleteGame(id: string) {
  const db = await getDB();
  await db.delete('games', id);
}

export async function saveOpeningCategory(cat: OpeningCategory) {
  const db = await getDB();
  await db.put('opening_categories', cat);
}

export async function getAllOpeningCategories(): Promise<OpeningCategory[]> {
  const db = await getDB();
  return db.getAll('opening_categories');
}

export async function deleteOpeningCategory(id: string) {
  const db = await getDB();
  await db.delete('opening_categories', id);
}

export async function saveTrainingPlan(plan: TrainingPlan) {
  const db = await getDB();
  await db.put('training_plans', plan);
}

export async function getAllTrainingPlans(): Promise<TrainingPlan[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('training_plans', 'by_date');
  return all.reverse();
}

export async function exportAllData() {
  const db = await getDB();
  const games = await db.getAll('games');
  const categories = await db.getAll('opening_categories');
  const plans = await db.getAll('training_plans');
  return { games, opening_categories: categories, training_plans: plans };
}

export async function importAllData(data: {
  games?: GameSummary[];
  opening_categories?: OpeningCategory[];
  training_plans?: TrainingPlan[];
}) {
  const db = await getDB();
  const tx = db.transaction(['games', 'opening_categories', 'training_plans'], 'readwrite');
  if (data.games) for (const g of data.games) await tx.objectStore('games').put(g);
  if (data.opening_categories) for (const c of data.opening_categories) await tx.objectStore('opening_categories').put(c);
  if (data.training_plans) for (const p of data.training_plans) await tx.objectStore('training_plans').put(p);
  await tx.done;
}
