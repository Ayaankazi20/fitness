import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Chips, Empty, H2, Muted, Screen } from '../components/ui';
import { api } from '../services/api';
import { useDraft } from '../store/draft';
import type { DraftFood, MealType } from '../types/api';
import { mealLabel, round, serving, totalOf } from '../utils/nutrition';

const TYPES = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'] as const;

function FoodRow({ food, onPick }: { food: DraftFood; onPick: () => void }) {
  const { setWeight, remove } = useDraft();
  const [text, setText] = useState(String(food.weight_g));
  React.useEffect(() => { setText(String(food.weight_g)); }, [food.weight_g]);
  const n = food.per_100g ? serving(food.per_100g, food.weight_g) : null;
  const commit = (s: string) => { const v = parseFloat(s); if (Number.isFinite(v) && v > 0) setWeight(food.key, v); else setText(String(food.weight_g)); };
  const step = (d: number) => setWeight(food.key, food.weight_g + d);
  return (
    <Card className={`mb-3 p-4 ${food.needs_review || !food.per_100g ? 'border border-amber-400' : ''}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-bold text-slate-900 dark:text-white">{food.name}</Text>
          {food.ai_detected && food.confidence != null ? <Muted>AI confidence {Math.round(food.confidence * 100)}%{food.needs_review ? ' · please check' : ''}</Muted> : null}
          {food.uncertainty ? <Muted>{food.uncertainty}</Muted> : null}
          {!food.per_100g ? <Text className="mt-1 text-sm text-amber-600">Not found in the nutrition database — tap Change to search.</Text> : null}
        </View>
        <Pressable onPress={() => remove(food.key)} accessibilityLabel={`Remove ${food.name}`} hitSlop={10}><Text className="text-xl text-slate-400">✕</Text></Pressable>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable onPress={() => step(-10)} accessibilityLabel="Decrease by 10 grams" className="h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800"><Text className="text-xl font-bold text-slate-700 dark:text-slate-200">−</Text></Pressable>
          <TextInput value={text} onChangeText={setText} onEndEditing={(e) => commit(e.nativeEvent.text)} onBlur={() => commit(text)} keyboardType="decimal-pad" accessibilityLabel={`${food.name} weight in grams`} className="mx-2 w-16 rounded-xl border border-slate-200 py-2 text-center text-lg font-bold text-slate-900 dark:border-slate-700 dark:text-white" />
          <Text className="mr-2 text-slate-500">g</Text>
          <Pressable onPress={() => step(10)} accessibilityLabel="Increase by 10 grams" className="h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800"><Text className="text-xl font-bold text-slate-700 dark:text-slate-200">+</Text></Pressable>
        </View>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-white">{n ? round(n.calories) : '—'} <Text className="text-sm font-medium text-slate-500">kcal</Text></Text>
      </View>
      {n ? <Muted className="mt-2">P {Math.round(n.protein_g)}g · C {Math.round(n.carbs_g)}g · F {Math.round(n.fat_g)}g</Muted> : null}
      <Pressable onPress={onPick} className="mt-2 self-start"><Text className="text-sm font-semibold text-brand">Change food</Text></Pressable>
    </Card>
  );
}

export default function ReviewMealScreen() {
  const nav = useNavigation<any>();
  const { foods, mealType, setMealType, scanId, warnings, overall, editingMealId, clear } = useDraft();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const total = totalOf(foods);
  const unresolved = foods.filter((f) => !f.per_100g).length;

  const save = async () => {
    setErr(null);
    if (!foods.length) return setErr('Add at least one food.');
    if (unresolved) return setErr('Some foods have no nutrition data. Change or remove them first.');
    setBusy(true);
    const items = foods.map((f) => ({ name: f.name, weight_g: f.weight_g, food_item_id: f.food_item_id ?? undefined, ai_detected: f.ai_detected, confidence: f.confidence ?? undefined }));
    try {
      if (editingMealId) await api.updateMeal(editingMealId, { meal_type: mealType, items }); else await api.saveMeal({ meal_type: mealType as MealType, scan_id: scanId ?? undefined, items });
      clear(); nav.popToTop(); nav.navigate('Tabs', { screen: 'Home' });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const discard = () => Alert.alert('Discard this meal?', 'Your changes will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { clear(); nav.popToTop(); } }]);

  return (
    <Screen footer={
      <View className="border-t border-slate-200 bg-white px-5 pb-8 pt-3 dark:border-slate-800 dark:bg-slate-900">
        {err ? <Text className="mb-2 text-center text-red-500" accessibilityLiveRegion="polite">{err}</Text> : null}
        <Button title={editingMealId ? 'Save changes' : `Add to ${mealLabel(mealType)}`} onPress={save} loading={busy} disabled={!foods.length} />
      </View>}>
      <View className="mb-2 flex-row items-center justify-between"><Text className="text-3xl font-extrabold text-slate-900 dark:text-white">Your Meal</Text><Pressable onPress={discard}><Text className="text-slate-500">Discard</Text></Pressable></View>
      {warnings.map((w) => (<View key={w.code} className="mb-2 rounded-2xl bg-amber-100 p-3 dark:bg-amber-900/40"><Text className="text-sm text-amber-900 dark:text-amber-100">⚠️ {w.message}</Text></View>))}
      {overall != null && !warnings.some((w) => w.code === 'LOW_CONFIDENCE') ? <Muted className="mb-2">AI confidence {Math.round(overall * 100)}% · portions are visual estimates</Muted> : null}
      <Card className="mb-4 items-center">
        <Text className="text-5xl font-extrabold text-brand">{round(total.calories)}</Text><Text className="mb-3 text-slate-500">kcal · Estimated</Text>
        <View className="w-full flex-row justify-around">
          {[['Protein', total.protein_g, 'text-protein'], ['Carbs', total.carbs_g, 'text-carbs'], ['Fat', total.fat_g, 'text-fat'], ['Fiber', total.fiber_g, 'text-slate-500']].map(([n, v, c]) => (<View key={n as string} className="items-center"><Text className={`text-xl font-extrabold ${c}`}>{Math.round(v as number)}g</Text><Muted>{n}</Muted></View>))}
        </View>
      </Card>
      <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">Meal</Text>
      <Chips options={TYPES} value={mealType} onChange={setMealType} labels={{ BREAKFAST: 'Breakfast', LUNCH: 'Lunch', SNACK: 'Snack', DINNER: 'Dinner' }} />
      <H2 className="mb-3">Items</H2>
      {!foods.length ? <Card><Empty emoji="🍽️" title="No foods yet" body="Search to add what you ate." /></Card> : null}
      {foods.map((f) => <FoodRow key={f.key} food={f} onPick={() => nav.navigate('FoodSearch', { replaceKey: f.key })} />)}
      <Button variant="secondary" title="+ Add food" onPress={() => nav.navigate('FoodSearch', {})} className="mt-1" />
      <Muted className="mt-4 text-center">Nutrition is estimated from a food database and your portion sizes. Values may vary.</Muted>
    </Screen>
  );
}
