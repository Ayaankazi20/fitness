import * as SecureStore from 'expo-secure-store';
import type { AnalyzeResponse, ChatMessage, Dashboard, FoodSearchResult, Me, Meal, MealType, ProfileResponse, Progress, Targets, Tokens, WeightResponse } from '../types/api';
import { tzOffset } from '../utils/nutrition';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const KEY = 'fitscan.tokens';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) { super(message); }
}

let tokens: Tokens | null = null;
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

export async function loadTokens(): Promise<Tokens | null> {
  try { const raw = await SecureStore.getItemAsync(KEY); tokens = raw ? (JSON.parse(raw) as Tokens) : null; } catch { tokens = null; }
  return tokens;
}
export async function saveTokens(t: Tokens | null) {
  tokens = t;
  try { if (t) await SecureStore.setItemAsync(KEY, JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token })); else await SecureStore.deleteItemAsync(KEY); } catch { /* storage unavailable */ }
}

async function parse(res: Response) {
  if (res.status === 204) return undefined;
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? `Request failed (${res.status})`, body?.error?.details);
  return body;
}

async function send(path: string, init: RequestInit & { timeoutMs?: number }, auth: boolean): Promise<any> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20000);
  try {
    const headers: Record<string, string> = { ...(init.headers as any) };
    if (auth && tokens) headers.Authorization = `Bearer ${tokens.access_token}`;
    return await fetch(`${API_URL}/api${path}`, { ...init, headers, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ApiError(0, 'TIMEOUT', 'The request took too long. Check your connection and try again.');
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your internet connection.");
  } finally { clearTimeout(timer); }
}

let refreshing: Promise<boolean> | null = null;
async function refreshTokens(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= (async () => {
    try { const r = await send('/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: tokens!.refresh_token }) }, false);
      if (!r.ok) return false; const b = await r.json(); await saveTokens({ access_token: b.access_token, refresh_token: b.refresh_token }); return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

async function request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}, auth = true): Promise<T> {
  let res = await send(path, init, auth);
  if (res.status === 401 && auth && tokens) {
    if (await refreshTokens()) res = await send(path, init, auth);
    else { await saveTokens(null); onSessionExpired?.(); }
  }
  return parse(res);
}
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  async register(email: string, password: string) { const r = await request<{ user: any; tokens: Tokens }>('/auth/register', json('POST', { email, password }), false); await saveTokens(r.tokens); },
  async login(email: string, password: string) { const r = await request<{ user: any; tokens: Tokens }>('/auth/login', json('POST', { email, password }), false); await saveTokens(r.tokens); },
  async logout() { const t = tokens; try { if (t) await request('/auth/logout', json('POST', { refresh_token: t.refresh_token }), false); } finally { await saveTokens(null); } },
  forgotPassword: (email: string) => request<{ message: string }>('/auth/forgot-password', json('POST', { email }), false),
  resetPassword: (email: string, code: string, password: string) => request<void>('/auth/reset-password', json('POST', { email, code, password }), false),
  async changePassword(current_password: string, new_password: string) { const r = await request<{ tokens: Tokens }>('/auth/change-password', json('POST', { current_password, new_password })); await saveTokens(r.tokens); },
  me: () => request<Me>('/auth/me'),
  onboarding: (profile: unknown, goal: unknown) => request<ProfileResponse>('/onboarding', json('POST', { profile, goal })),
  profile: () => request<ProfileResponse>('/profile'),
  updateTargets: (t: Omit<Targets, 'is_manual' | 'is_estimate' | 'disclaimer'>) => request<Targets>('/nutrition/targets', json('PUT', t)),
  recalcTargets: () => request<Targets>('/nutrition/targets/recalculate', json('POST')),
  dashboard: () => request<Dashboard>(`/dashboard?tz=${tzOffset()}`),
  progress: (range: 'week' | 'month') => request<Progress>(`/progress?range=${range}&tz=${tzOffset()}`),
  analyze(uri: string, mime = 'image/jpeg') {
    const form = new FormData();
    form.append('image', { uri, name: 'meal.jpg', type: mime } as any);
    return request<AnalyzeResponse>('/food/analyze', { method: 'POST', body: form, timeoutMs: 60000 });
  },
  searchFood: (q: string) => request<{ results: FoodSearchResult[]; warnings: string[] }>(`/food/search?q=${encodeURIComponent(q)}`),
  saveMeal: (body: { meal_type: MealType; scan_id?: string; items: unknown[] }) => request<Meal>('/meals', json('POST', body)),
  updateMeal: (id: string, body: unknown) => request<Meal>(`/meals/${id}`, json('PUT', body)),
  deleteMeal: (id: string) => request<void>(`/meals/${id}`, { method: 'DELETE' }),
  meals: (days = 14) => request<{ meals: Meal[] }>(`/meals?tz=${tzOffset()}&limit=200`).then((r) => r),
  meal: (id: string) => request<Meal>(`/meals/${id}`),
  weights: () => request<WeightResponse>('/weight'),
  addWeight: (weight_kg: number) => request('/weight', json('POST', { weight_kg })),
  deleteWeight: (id: string) => request<void>(`/weight/${id}`, { method: 'DELETE' }),
  chat: (message: string, conversation_id?: string) => request<{ conversation_id: string; reply: string; disclaimer: string }>('/ai/chat', { ...json('POST', { message, conversation_id, tz: tzOffset() }), timeoutMs: 45000 }),
  latestChat: () => request<{ conversation_id: string | null; messages: ChatMessage[] }>('/ai/conversations/latest'),
};
