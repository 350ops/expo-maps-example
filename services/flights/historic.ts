import baked from '../../data/historicApproaches.json';
import type { Resort } from '../../data/resorts';
import type { Trajectory } from './types';

const byResort = baked as Record<string, Trajectory[]>;

export function loadHistoricApproaches(resort: Resort, limit = 30): Trajectory[] {
  const list = byResort[resort.id] ?? [];
  return list.slice(0, limit);
}
