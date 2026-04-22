import baked from '../../data/historicApproaches.json';
import type { Resort } from '../../data/resorts';
import type { Trajectory } from './types';

const byResort = baked as Record<string, Trajectory[]>;

type HistoricOptions = {
  maxAgeDays?: number;
};

export function loadHistoricApproaches(
  resort: Resort,
  limit = 30,
  options: HistoricOptions = {},
): Trajectory[] {
  const list = byResort[resort.id] ?? [];
  const { maxAgeDays } = options;
  if (typeof maxAgeDays !== 'number' || maxAgeDays <= 0) {
    return list.slice(0, limit);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const cutoffSec = nowSec - Math.floor(maxAgeDays * 86400);
  return list.filter((t) => t.landedAt >= cutoffSec).slice(0, limit);
}
