import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button, Card, ErrorBox, H1, Loading, Muted, Screen } from '../components/ui';
import { useLoad } from '../hooks/useAsync';
import { api } from '../services/api';
import { useDraft } from '../store/draft';
import { mealLabel, round } from '../utils/nutrition';

export default function MealDetailScreen() {
  const nav = useNavigation<any>(); const { id } = useRoute().params as { id: string };
  const { data: m, error, loading, retry } = useLoad(() => api.meal(id), [id]);
  const startEdit = useDraft((s) => s.startEdit); const [busy, setBusy] = useState(false);
  if (loading && !m) return <Screen scroll={false}><Loading /></Screen>;
  if (!m) return <Screen><ErrorBox message={error ?? 'Meal not found'} onRetry={retry} /></Screen>;
  const edit = () => {
    startEdit(m.id, m.meal_type, m.items.map((i) => ({ key: i.id, name: i.name, weight_g: i.weight_g, food_item_id: i.food_item_id, per_100g: i.weight_g ? { calories: (i.calories / i.weight_g) * 100, protein_g: (i.protein_g / i.weight_g) * 100, carbs_g: (i.carbs_g / i.weight_g) * 100, fat_g: (i.fat_g / i.weight_g) * 100, fiber_g: (i.fiber_g / i.weight_g) * 100, sugar_g: (i.sugar_g / i.weight_g) * 100, sodium_mg: (i.sodium_mg / i.weight_g) * 100 } : null, confidence: i.confidence, ai_detected: i.ai_detected, needs_review: false, matched: true })));
    nav.navigate('ReviewMeal');
  };
  const del = () => Alert.alert('Delete this meal?', 'This removes it from your daily totals.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { setBusy(true); try { await api.deleteMeal(m.id); nav.goBack(); } catch (e: any) { Alert.alert('Could not delete', e.message); setBusy(false); } } }]);
  return (
    <Screen>
      <H1 className="mt-2">{mealLabel(m.meal_type)}</H1>
      <Muted className="mb-4">{new Date(m.eaten_at).toLocaleString()}</Muted>
      <Card className="mb-4 items-center"><Text className="text-5xl font-extrabold text-brand">{round(m.totals.calories)}</Text><Muted className="mb-2">kcal · Estimated</Muted><Text className="text-slate-700 dark:text-slate-200">P {Math.round(m.totals.protein_g)}g · C {Math.round(m.totals.carbs_g)}g · F {Math.round(m.totals.fat_g)}g · Fiber {Math.round(m.totals.fiber_g)}g</Text></Card>
      {m.items.map((i) => (<Card key={i.id} className="mb-2 p-4"><View className="flex-row justify-between"><Text className="font-bold text-slate-900 dark:text-white">{i.name}</Text><Text className="font-bold text-slate-900 dark:text-white">{round(i.calories)} kcal</Text></View><Muted>{Math.round(i.weight_g)}g · P {Math.round(i.protein_g)} · C {Math.round(i.carbs_g)} · F {Math.round(i.fat_g)}</Muted></Card>))}
      <Button title="Edit meal" onPress={edit} className="mb-2 mt-3" />
      <Button title="Delete meal" variant="danger" onPress={del} loading={busy} />
    </Screen>
  );
}
