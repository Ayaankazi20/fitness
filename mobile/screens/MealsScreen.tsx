import React, { useMemo } from 'react';
import { RefreshControl, Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, Empty, ErrorBox, H1, Loading, Muted, Screen } from '../components/ui';
import { useLoad } from '../hooks/useAsync';
import { api } from '../services/api';
import { localDate, mealLabel, round } from '../utils/nutrition';
import type { Meal } from '../types/api';

const dayLabel = (d: string) => {
  const t = localDate(), y = localDate(new Date(Date.now() - 86400000));
  return d === t ? 'Today' : d === y ? 'Yesterday' : new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function MealsScreen() {
  const nav = useNavigation<any>();
  const { data, error, loading, refreshing, reload, retry } = useLoad(() => api.meals());
  const groups = useMemo(() => {
    const m = new Map<string, Meal[]>();
    for (const meal of data?.meals ?? []) { const d = localDate(new Date(meal.eaten_at)); m.set(d, [...(m.get(d) ?? []), meal]); }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [data]);
  if (loading && !data) return <Screen scroll={false}><Loading /></Screen>;
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <H1 className="mb-4 mt-2">Meal History</H1>
      {error && !data ? <ErrorBox message={error} onRetry={retry} /> : null}
      {data && !groups.length ? <Empty emoji="📖" title="No meals yet" body="Meals you log will show up here, grouped by day." /> : null}
      {groups.map(([day, meals]) => {
        const kcal = meals.reduce((s, m) => s + m.totals.calories, 0);
        return (
          <View key={day} className="mb-5">
            <View className="mb-2 flex-row items-end justify-between"><Text className="text-lg font-bold text-slate-900 dark:text-white">{dayLabel(day)}</Text><Muted>{round(kcal)} kcal</Muted></View>
            {meals.map((m) => (
              <Pressable key={m.id} onPress={() => nav.navigate('MealDetail', { id: m.id })} accessibilityRole="button" accessibilityLabel={`${mealLabel(m.meal_type)}, ${Math.round(m.totals.calories)} calories`}>
                <Card className="mb-2.5 p-4">
                  <View className="flex-row justify-between"><Text className="font-bold text-slate-900 dark:text-white">{mealLabel(m.meal_type)} · <Text className="font-normal text-slate-500">{timeOf(m.eaten_at)}</Text></Text><Text className="font-extrabold text-slate-900 dark:text-white">{round(m.totals.calories)} kcal</Text></View>
                  <Muted className="mt-1" >{m.items.map((i) => `${i.name} ${Math.round(i.weight_g)}g`).join(' · ')}</Muted>
                  <Muted className="mt-1.5">P {Math.round(m.totals.protein_g)}g · C {Math.round(m.totals.carbs_g)}g · F {Math.round(m.totals.fat_g)}g</Muted>
                </Card>
              </Pressable>))}
          </View>);
      })}
    </Screen>
  );
}
