export function normalizeFoodName(s: string): string {
  return s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
const STOP = new Set(['with', 'and', 'in', 'of', 'the', 'a', 'raw', 'fresh']);
export function tokens(s: string): string[] { return normalizeFoodName(s).split(' ').filter((t) => t && !STOP.has(t)); }

/** 0..1 similarity between a query and a candidate food name. */
export function matchScore(query: string, candidate: string): number {
  const nq = normalizeFoodName(query), nc = normalizeFoodName(candidate);
  if (!nq || !nc) return 0;
  if (nq === nc) return 1;
  const q = tokens(query), c = new Set(tokens(candidate));
  if (!q.length || !c.size) return 0;
  const inter = q.filter((t) => c.has(t)).length;
  if (!inter) return 0;
  let score = (inter / q.length) * 0.7 + (inter / c.size) * 0.3;
  if (inter === q.length && nc.startsWith(q[0]!)) score = Math.min(1, score + 0.1);
  return score;
}
