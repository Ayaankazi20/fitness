import React from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Empty, ErrorBox, H2, Loading, Muted, Screen } from '../components/ui';
import { MacroBar, Ring } from '../components/charts';
import { useLoad } from '../hooks/useAsync';
import { api } from '../services/api';
import { greeting, mealLabel, round } from '../utils/nutrition';

const ICON = { BREAKFAST: '🍳', LUNCH: '🍛', SNACK: '🍎', DINNER: '🌙' } as const;

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const { data: d, error, loading, refreshing, reload, retry } = useLoad(() => api.dashboard());
  if (loading && !d) return <Screen scroll={false}><Loading /></Screen>;
  if (error && !d) return <Screen><ErrorBox message={error} onRetry={retry} /></Screen>;
  if (!d) return null;
  const t = d.targets, c = d.consumed, over = d.remaining.calories < 0;
  const scan = () => nav.navigate('Scan');
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Text className="mb-1 mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{greeting()}, {d.name} 👋</Text>
      <Muted className="mb-4">Targets are estimates, not medical advice.</Muted>
      <Card className="mb-4">
        <View className="items-center">
          <Ring value={c.calories} max={t.calories} label={round(c.calories)} sub={`of ${round(t.calories)} kcal`} />
          <Text className={`mt-3 text-base font-semibold ${over ? 'text-red-500' : 'text-brand'}`}>{over ? `${round(-d.remaining.calories)} kcal over target` : `${round(d.remaining.calories)} kcal remaining`}</Text>
          <Muted>{round(Math.max(0, d.remaining.protein_g))}g protein still to go</Muted>
        </View>
        <View className="mt-5">
          <MacroBar name="Protein" value={c.protein_g} target={t.protein_g} color="#3b82f6" />
          <MacroBar name="Carbs" value={c.carbs_g} target={t.carbs_g} color="#f59e0b" />
          <MacroBar name="Fat" value={c.fat_g} target={t.fat_g} color="#ec4899" />
        </View>
      </Card>
      <Button title="📷  Scan Food" onPress={scan} className="mb-5 h-16" />
      <H2 className="mb-3">Today's meals</H2>
      {d.meal_count === 0 ? <Card><Empty emoji="🍽️" title="Nothing logged yet" body="Scan your first meal to start today's totals." /></Card> : null}
      {d.meals_by_type.map((g) => (
        <Card key={g.meal_type} className="mb-3 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center"><Text className="mr-2 text-2xl">{ICON[g.meal_type]}</Text><Text className="text-base font-bold text-slate-800 dark:text-slate-100">{mealLabel(g.meal_type)}</Text></View>
            <Text className="font-bold text-slate-900 dark:text-white">{g.meals.length ? `${round(g.totals.calories)} kcal` : '—'}</Text>
          </View>
          {g.meals.map((m) => (<Text key={m.id} onPress={() => nav.navigate('MealDetail', { id: m.id })} className="mt-2 text-sm text-slate-500" numberOfLines={1}>{m.items.map((i) => i.name).join(', ')}</Text>))}
        </Card>
      ))}
      <H2 className="mb-3 mt-3">This week</H2>
      <Card className="mb-3">
        <Text className="text-3xl font-extrabold text-slate-900 dark:text-white">{d.weekly.days_target_achieved} / {d.weekly.days_in_range} <Text className="text-base font-medium text-slate-500">days on target</Text></Text>
        <View className="mt-3 flex-row gap-1.5">{d.weekly.days.map((x) => <View key={x.date} className={`h-2.5 flex-1 rounded-full ${x.achieved ? 'bg-brand' : 'bg-slate-200 dark:bg-slate-800'}`} />)}</View>
        <Muted className="mt-2">Avg {round(d.weekly.avg_calories)} kcal · {round(d.weekly.avg_protein_g)}g protein on logged days</Muted>
      </Card>
      <Card><View className="flex-row items-center justify-between"><View><Muted>Current weight</Muted><Text className="text-2xl font-extrabold text-slate-900 dark:text-white">{d.weight.current_kg} kg</Text></View>
        <Text className="text-slate-500">{d.weight.change_kg != null ? `${d.weight.change_kg > 0 ? '+' : ''}${d.weight.change_kg} kg since start` : ''}{d.weight.target_kg ? `\nTarget ${d.weight.target_kg} kg` : ''}</Text></View></Card>
    </Screen>
  );
}
