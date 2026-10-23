import React, { useState } from 'react';
import { Alert, RefreshControl, Text, View } from 'react-native';
import { BarChart, LineChart } from '../components/charts';
import { Button, Card, Chips, ErrorBox, Field, H1, H2, Loading, Muted, Screen } from '../components/ui';
import { useLoad } from '../hooks/useAsync';
import { api } from '../services/api';
import { round } from '../utils/nutrition';

export default function ProgressScreen() {
  const [range, setRange] = useState<'week' | 'month'>('week');
  const p = useLoad(() => api.progress(range), [range]);
  const w = useLoad(() => api.weights());
  const [kg, setKg] = useState(''); const [busy, setBusy] = useState(false);
  const addWeight = async () => {
    const v = parseFloat(kg); if (!(v >= 25 && v <= 350)) return Alert.alert('Enter a valid weight', 'Between 25 and 350 kg.');
    setBusy(true); try { await api.addWeight(v); setKg(''); await Promise.all([w.reload(), p.reload()]); } catch (e: any) { Alert.alert('Could not save', e.message); } finally { setBusy(false); }
  };
  if (p.loading && !p.data) return <Screen scroll={false}><Loading /></Screen>;
  const d = p.data;
  return (
    <Screen refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={() => { p.reload(); w.reload(); }} />}>
      <H1 className="mb-3 mt-2">Progress</H1>
      <Chips options={['week', 'month'] as const} value={range} onChange={setRange} labels={{ week: 'Week', month: 'Month' }} />
      {p.error && !d ? <ErrorBox message={p.error} onRetry={p.retry} /> : null}
      {d ? (<>
        <Card className="mb-4"><Muted>Goal consistency</Muted><Text className="text-4xl font-extrabold text-slate-900 dark:text-white">{d.summary.days_target_achieved} / {d.summary.days_in_range} <Text className="text-base font-medium text-slate-500">days on target</Text></Text><Muted className="mt-1">Within ±15% of your estimated calorie target · {d.summary.days_logged} days logged</Muted></Card>
        <Card className="mb-4"><H2 className="mb-1">Calories</H2><Muted className="mb-2">Avg {round(d.summary.avg_calories)} kcal on logged days · dashed line = target</Muted><BarChart data={d.series.map((s) => ({ x: s.date, y: s.calories, hit: s.achieved }))} target={d.targets.calories} unit="kcal" /></Card>
        <Card className="mb-4"><H2 className="mb-1">Protein</H2><Muted className="mb-2">Avg {round(d.summary.avg_protein_g)}g · target {d.targets.protein_g}g</Muted><BarChart data={d.series.map((s) => ({ x: s.date, y: s.protein_g, hit: s.protein_g >= d.targets.protein_g * 0.9 }))} target={d.targets.protein_g} color="#3b82f6" unit="g" /></Card>
      </>) : null}
      <Card className="mb-4">
        <H2 className="mb-1">Weight</H2>
        {w.data ? <Muted className="mb-2">{w.data.summary.current_kg} kg now{w.data.summary.change_kg != null ? ` · ${w.data.summary.change_kg > 0 ? '+' : ''}${w.data.summary.change_kg} kg since first log` : ''}</Muted> : null}
        <LineChart points={(w.data?.logs ?? []).slice(-60).map((l) => ({ x: l.date, y: l.weight_kg }))} />
        <View className="mt-3 flex-row items-end gap-3"><View className="flex-1"><Field label="Log today's weight (kg)" value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="72.4" /></View><Button title="Add" onPress={addWeight} loading={busy} className="mb-4 h-14" /></View>
      </Card>
    </Screen>
  );
}
