import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Empty, Muted } from '../components/ui';
import { api } from '../services/api';
import { useDraft } from '../store/draft';
import type { FoodSearchResult } from '../types/api';

export default function FoodSearchScreen() {
  const nav = useNavigation<any>(); const { replaceKey } = (useRoute().params ?? {}) as { replaceKey?: string };
  const { add, replace } = useDraft();
  const [q, setQ] = useState(''); const [res, setRes] = useState<FoodSearchResult[]>([]); const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null); const [warn, setWarn] = useState(false); const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); setErr(null); return; }
    const id = ++seq.current; setLoading(true);
    const t = setTimeout(async () => {
      try { const r = await api.searchFood(q.trim()); if (id === seq.current) { setRes(r.results); setWarn(r.warnings.length > 0); setErr(null); } }
      catch (e: any) { if (id === seq.current) setErr(e.message); }
      finally { if (id === seq.current) setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const choose = (f: FoodSearchResult) => { replaceKey ? replace(replaceKey, f) : add(f); nav.goBack(); };
  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950" edges={['top']}>
      <View className="flex-row items-center px-5 pb-3 pt-2">
        <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Search foods (e.g. dal, paneer, banana)" placeholderTextColor="#94a3b8" accessibilityLabel="Search foods" className="h-12 flex-1 rounded-2xl bg-white px-4 text-base text-slate-900 dark:bg-slate-900 dark:text-white" />
        <Pressable onPress={() => nav.goBack()} className="ml-3"><Text className="font-semibold text-brand">Cancel</Text></Pressable>
      </View>
      {loading ? <ActivityIndicator className="mt-4" color="#16a34a" /> : null}
      {err ? <Text className="px-5 pt-3 text-center text-red-500">{err}</Text> : null}
      {warn && !err ? <Text className="px-5 pb-2 text-center text-xs text-amber-600">Some nutrition sources are unavailable; showing what we found.</Text> : null}
      <FlatList data={res} keyExtractor={(i) => i.food_item_id} keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-10"
        ListEmptyComponent={!loading && q.trim().length >= 2 && !err ? <Empty emoji="🔍" title="No matches" body="Try a simpler name, like “rice” or “chicken curry”." /> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => choose(item)} className="mb-2 rounded-2xl bg-white p-4 active:opacity-70 dark:bg-slate-900">
            <Text className="text-base font-bold text-slate-900 dark:text-white">{item.name}</Text>
            <Muted>{Math.round(item.per_100g.calories)} kcal · P {item.per_100g.protein_g}g · C {item.per_100g.carbs_g}g · F {item.per_100g.fat_g}g per 100g</Muted>
          </Pressable>)} />
    </SafeAreaView>
  );
}
