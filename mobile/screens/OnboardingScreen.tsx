import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Chips, Field, H1, Muted, Screen } from '../components/ui';
import { api } from '../services/api';
import { useSession } from '../store/session';
import type { ActivityLevel, Gender, GoalType, ProfileResponse } from '../types/api';
import { round } from '../utils/nutrition';

const ACT: Record<ActivityLevel, string> = { SEDENTARY: 'Sedentary', LIGHT: 'Lightly active', MODERATE: 'Moderately active', VERY_ACTIVE: 'Very active', EXTREME: 'Extremely active' };
const GOAL: Record<GoalType, string> = { LOSE_WEIGHT: 'Lose weight', MAINTAIN: 'Maintain weight', GAIN_MUSCLE: 'Gain muscle', GAIN_WEIGHT: 'Gain weight' };
const GEN: Record<Gender, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };
const DIET = ['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan'] as const;
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: '', age: '', height: '', weight: '', gender: undefined as Gender | undefined, activity: 'LIGHT' as ActivityLevel, goal: 'MAINTAIN' as GoalType, target: '', diet: undefined as string | undefined, allergies: '' });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [result, setResult] = useState<ProfileResponse | null>(null);
  const refreshMe = useSession((s) => s.refreshMe);
  const set = (k: keyof typeof f) => (v: any) => setF((p) => ({ ...p, [k]: v }));

  const next = () => {
    setErr(null);
    if (step === 0) {
      if (!f.name.trim()) return setErr('Please enter your name.');
      const age = num(f.age), h = num(f.height), w = num(f.weight);
      if (!(age >= 13 && age <= 100)) return setErr('Enter an age between 13 and 100.');
      if (!(h >= 100 && h <= 250)) return setErr('Enter your height in cm (100–250).');
      if (!(w >= 25 && w <= 350)) return setErr('Enter your weight in kg (25–350).');
      if (!f.gender) return setErr('Select a gender.');
    }
    setStep(step + 1);
  };
  const finish = async () => {
    setErr(null);
    const target = f.target.trim() ? num(f.target) : undefined;
    if (target !== undefined && !(target >= 25 && target <= 350)) return setErr('Target weight must be 25–350 kg, or leave it blank.');
    setBusy(true);
    try {
      const r = await api.onboarding({ name: f.name.trim(), age: num(f.age), gender: f.gender, height_cm: num(f.height), weight_kg: num(f.weight), activity_level: f.activity, dietary_preference: f.diet || undefined, allergies: f.allergies.split(',').map((s) => s.trim()).filter(Boolean) }, { goal_type: f.goal, target_weight_kg: target });
      setResult(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (result?.targets) {
    const t = result.targets;
    return (
      <Screen className="pt-10">
        <H1>Your estimated daily target</H1>
        <Muted className="mb-5 mt-1">{t.disclaimer} You can edit it any time in Profile.</Muted>
        <Card className="mb-4 items-center"><Text className="text-6xl font-extrabold text-brand">{round(t.calories)}</Text><Text className="text-slate-500">kcal / day (estimated)</Text></Card>
        <View className="mb-6 flex-row gap-3">
          {[['Protein', t.protein_g, 'text-protein'], ['Carbs', t.carbs_g, 'text-carbs'], ['Fat', t.fat_g, 'text-fat']].map(([n, v, c]) => (
            <Card key={n as string} className="flex-1 items-center p-4"><Text className={`text-2xl font-extrabold ${c}`}>{v}g</Text><Muted>{n}</Muted></Card>))}
        </View>
        <Button title="Start tracking" onPress={refreshMe} />
      </Screen>
    );
  }
  return (
    <Screen className="pt-8">
      <Muted>Step {step + 1} of 3</Muted>
      <View className="mb-5 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><View style={{ width: `${((step + 1) / 3) * 100}%` }} className="h-full bg-brand" /></View>
      {step === 0 && (<>
        <H1 className="mb-4">About you</H1>
        <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="Ayaan" />
        <View className="flex-row gap-3"><View className="flex-1"><Field label="Age" value={f.age} onChangeText={set('age')} keyboardType="number-pad" /></View><View className="flex-1"><Field label="Height (cm)" value={f.height} onChangeText={set('height')} keyboardType="decimal-pad" /></View></View>
        <Field label="Weight (kg)" value={f.weight} onChangeText={set('weight')} keyboardType="decimal-pad" />
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">Gender</Text>
        <Chips options={['MALE', 'FEMALE', 'OTHER'] as const} value={f.gender} onChange={set('gender')} labels={GEN} />
      </>)}
      {step === 1 && (<>
        <H1 className="mb-4">Activity & goal</H1>
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">How active are you?</Text>
        <Chips options={Object.keys(ACT) as ActivityLevel[]} value={f.activity} onChange={set('activity')} labels={ACT} />
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">Your goal</Text>
        <Chips options={Object.keys(GOAL) as GoalType[]} value={f.goal} onChange={set('goal')} labels={GOAL} />
        <Field label="Target weight in kg (optional)" value={f.target} onChangeText={set('target')} keyboardType="decimal-pad" />
      </>)}
      {step === 2 && (<>
        <H1 className="mb-1">Food preferences</H1><Muted className="mb-4">Optional. Helps the AI coach suggest the right foods.</Muted>
        <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">Dietary preference</Text>
        <Chips options={DIET} value={f.diet as any} onChange={(v) => set('diet')(f.diet === v ? undefined : v)} />
        <Field label="Allergies (comma separated)" value={f.allergies} onChangeText={set('allergies')} placeholder="peanuts, shellfish" />
      </>)}
      {err ? <Text className="mb-3 text-red-500" accessibilityLiveRegion="polite">{err}</Text> : null}
      <View className="mt-2 flex-row gap-3">
        {step > 0 ? <Button title="Back" variant="secondary" onPress={() => setStep(step - 1)} className="flex-1" /> : null}
        {step < 2 ? <Button title="Next" onPress={next} className="flex-1" /> : <Button title="Calculate my target" onPress={finish} loading={busy} className="flex-1" />}
      </View>
      {step === 2 ? <Button variant="ghost" title="Skip optional questions" onPress={() => { set('diet')(undefined); set('allergies')(''); finish(); }} /> : null}
    </Screen>
  );
}
