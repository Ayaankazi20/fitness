import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, ErrorBox, Field, H1, H2, Loading, Muted, Screen } from '../components/ui';
import { useLoad } from '../hooks/useAsync';
import { api } from '../services/api';
import { useSession } from '../store/session';

export default function ProfileScreen() {
  const { data, error, loading, retry, reload } = useLoad(() => api.profile());
  const me = useSession((s) => s.me); const signOut = useSession((s) => s.signOut);
  const [pw, setPw] = useState<{ cur: string; next: string } | null>(null);
  const [edit, setEdit] = useState(false); const [f, setF] = useState({ calories: '', protein: '', carbs: '', fat: '' }); const [busy, setBusy] = useState(false);
  if (loading && !data) return <Screen scroll={false}><Loading /></Screen>;
  if (!data) return <Screen><ErrorBox message={error ?? 'Could not load profile'} onRetry={retry} /></Screen>;
  const t = data.targets, p = data.profile;
  const start = () => { if (t) setF({ calories: String(t.calories), protein: String(t.protein_g), carbs: String(t.carbs_g), fat: String(t.fat_g) }); setEdit(true); };
  const save = async () => {
    const [calories, protein_g, carbs_g, fat_g] = [f.calories, f.protein, f.carbs, f.fat].map(Number) as [number, number, number, number];
    if (!(calories >= 800 && calories <= 6000)) return Alert.alert('Calories out of range', 'Enter 800–6000 kcal.');
    if (![protein_g, carbs_g, fat_g].every((n) => Number.isFinite(n) && n >= 0)) return Alert.alert('Check macros', 'Enter valid gram amounts.');
    setBusy(true); try { await api.updateTargets({ calories, protein_g, carbs_g, fat_g }); setEdit(false); await reload(); } catch (e: any) { Alert.alert('Could not save', e.message); } finally { setBusy(false); }
  };
  const savePw = async () => {
    if (!pw || !pw.cur || pw.next.length < 8) return Alert.alert('Check your passwords', 'Enter your current password and a new one with at least 8 characters.');
    setBusy(true); try { await api.changePassword(pw.cur, pw.next); setPw(null); Alert.alert('Password changed'); } catch (e: any) { Alert.alert('Could not change password', e.message); } finally { setBusy(false); }
  };
  const reset = async () => { setBusy(true); try { await api.recalcTargets(); setEdit(false); await reload(); } catch (e: any) { Alert.alert('Could not recalculate', e.message); } finally { setBusy(false); } };
  return (
    <Screen>
      <H1 className="mb-1 mt-2">{p.name}</H1><Muted className="mb-4">{me?.email}</Muted>
      <Card className="mb-4">
        <H2 className="mb-1">Estimated daily target</H2><Muted className="mb-3">{t?.disclaimer}</Muted>
        {!edit ? (<>
          <Text className="text-4xl font-extrabold text-brand">{t?.calories} <Text className="text-base font-medium text-slate-500">kcal</Text></Text>
          <Muted className="mt-1">Protein {t?.protein_g}g · Carbs {t?.carbs_g}g · Fat {t?.fat_g}g{t?.is_manual ? ' · custom' : ''}</Muted>
          <Button title="Edit target" variant="secondary" onPress={start} className="mt-4" />
        </>) : (<>
          <Field label="Calories (kcal)" value={f.calories} onChangeText={(v) => setF({ ...f, calories: v })} keyboardType="number-pad" />
          <View className="flex-row gap-2"><View className="flex-1"><Field label="Protein g" value={f.protein} onChangeText={(v) => setF({ ...f, protein: v })} keyboardType="number-pad" /></View><View className="flex-1"><Field label="Carbs g" value={f.carbs} onChangeText={(v) => setF({ ...f, carbs: v })} keyboardType="number-pad" /></View><View className="flex-1"><Field label="Fat g" value={f.fat} onChangeText={(v) => setF({ ...f, fat: v })} keyboardType="number-pad" /></View></View>
          <Button title="Save target" onPress={save} loading={busy} className="mb-2" /><Button title="Reset to calculated estimate" variant="secondary" onPress={reset} /><Button title="Cancel" variant="ghost" onPress={() => setEdit(false)} />
        </>)}
      </Card>
      <Card className="mb-4"><H2 className="mb-2">Your details</H2>
        {[['Goal', data.goal?.goal_type.replace('_', ' ').toLowerCase()], ['Weight', `${p.weight_kg} kg`], ['Height', `${p.height_cm} cm`], ['Age', String(p.age)], ['Activity', p.activity_level.replace('_', ' ').toLowerCase()], ['Diet', p.dietary_preference ?? '—'], ['Allergies', p.allergies.join(', ') || '—']].map(([k, v]) => (<View key={k} className="flex-row justify-between py-1.5"><Muted>{k}</Muted><Text className="font-semibold capitalize text-slate-900 dark:text-white">{v}</Text></View>))}
      </Card>
      {pw ? (<Card className="mb-4"><H2 className="mb-3">Change password</H2>
        <Field label="Current password" value={pw.cur} onChangeText={(v) => setPw({ ...pw, cur: v })} secureTextEntry />
        <Field label="New password" value={pw.next} onChangeText={(v) => setPw({ ...pw, next: v })} secureTextEntry placeholder="At least 8 characters" />
        <Button title="Update password" onPress={savePw} loading={busy} className="mb-1" /><Button title="Cancel" variant="ghost" onPress={() => setPw(null)} /></Card>)
        : <Button title="Change password" variant="secondary" onPress={() => setPw({ cur: '', next: '' })} className="mb-3" />}
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
