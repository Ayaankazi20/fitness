import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export const Screen = ({ children, scroll = true, className = '', refreshControl, footer }: { children: React.ReactNode; scroll?: boolean; className?: string; refreshControl?: React.ReactElement<any>; footer?: React.ReactNode }) => (
  <SafeAreaView edges={['top']} className="flex-1 bg-slate-50 dark:bg-slate-950">
    {scroll ? <ScrollView refreshControl={refreshControl as any} contentContainerClassName={`px-5 pb-8 pt-2 ${className}`} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      : <View className={`flex-1 px-5 pt-2 ${className}`}>{children}</View>}
    {footer}
  </SafeAreaView>
);

export const Card = ({ children, className = '', ...p }: ViewProps & { className?: string }) => (
  <View {...p} className={`rounded-3xl bg-white p-5 dark:bg-slate-900 ${className}`} style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>{children}</View>
);

export const H1 = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <Text className={`text-3xl font-extrabold text-slate-900 dark:text-white ${className}`}>{children}</Text>;
export const H2 = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <Text className={`text-lg font-bold text-slate-900 dark:text-white ${className}`}>{children}</Text>;
export const Muted = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <Text className={`text-sm text-slate-500 dark:text-slate-400 ${className}`}>{children}</Text>;

export function Button({ title, onPress, variant = 'primary', loading, disabled, className = '' }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean; disabled?: boolean; className?: string }) {
  const bg = variant === 'primary' ? 'bg-brand' : variant === 'danger' ? 'bg-red-500' : variant === 'secondary' ? 'bg-slate-200 dark:bg-slate-800' : 'bg-transparent';
  const fg = variant === 'secondary' || variant === 'ghost' ? 'text-slate-800 dark:text-slate-100' : 'text-white';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled || loading}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
      className={`h-14 items-center justify-center rounded-2xl px-6 active:opacity-80 ${bg} ${disabled ? 'opacity-50' : ''} ${className}`}>
      {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#16a34a'} /> : <Text className={`text-base font-bold ${fg}`}>{title}</Text>}
    </Pressable>
  );
}

export const Field = ({ label, error, ...p }: TextInputProps & { label: string; error?: string }) => (
  <View className="mb-4">
    <Text className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</Text>
    <TextInput placeholderTextColor="#94a3b8" accessibilityLabel={label} {...p} className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
    {error ? <Text className="mt-1 text-sm text-red-500">{error}</Text> : null}
  </View>
);

export function Chips<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T | undefined; onChange: (v: T) => void; labels?: Record<string, string> }) {
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} accessibilityRole="button" accessibilityState={{ selected: value === o }} className={`rounded-full px-4 py-2.5 ${value === o ? 'bg-brand' : 'bg-slate-200 dark:bg-slate-800'}`}>
          <Text className={`text-sm font-semibold ${value === o ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{labels?.[o] ?? o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <Card className="items-center"><Text className="mb-1 text-3xl">⚠️</Text><Text className="mb-3 text-center text-base text-slate-700 dark:text-slate-200">{message}</Text>{onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" className="self-stretch" /> : null}</Card>
);
export const Empty = ({ emoji, title, body }: { emoji: string; title: string; body: string }) => (
  <View className="items-center py-10"><Text className="mb-2 text-5xl">{emoji}</Text><Text className="mb-1 text-lg font-bold text-slate-800 dark:text-slate-100">{title}</Text><Text className="px-6 text-center text-slate-500">{body}</Text></View>
);
export const Loading = () => <View className="flex-1 items-center justify-center py-20"><ActivityIndicator size="large" color="#16a34a" /></View>;
