import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import type { ChatMessage } from '../types/api';

const SUGGESTIONS = ['I have 600 calories left. What should I eat?', 'High-protein vegetarian dinner ideas', 'Am I on track today?'];

export default function CoachScreen() {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]); const [convo, setConvo] = useState<string | undefined>();
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const list = useRef<FlatList>(null);
  useEffect(() => { api.latestChat().then((r) => { setMsgs(r.messages); setConvo(r.conversation_id ?? undefined); }).catch(() => {}); }, []);
  const send = async (t = text) => {
    const m = t.trim(); if (!m || busy) return;
    setText(''); setErr(null); setBusy(true); setMsgs((x) => [...x, { role: 'USER', content: m }]);
    try { const r = await api.chat(m, convo); setConvo(r.conversation_id); setMsgs((x) => [...x, { role: 'ASSISTANT', content: r.reply }]); }
    catch (e: any) { setErr(e.message); setText(m); setMsgs((x) => x.slice(0, -1)); } finally { setBusy(false); }
  };
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50 dark:bg-slate-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View className="px-5 pb-2 pt-2"><Text className="text-3xl font-extrabold text-slate-900 dark:text-white">AI Coach</Text><Text className="text-xs text-slate-500">General guidance, not medical advice. For health conditions, consult a qualified healthcare professional.</Text></View>
        <FlatList ref={list} data={msgs} keyExtractor={(_, i) => String(i)} contentContainerClassName="px-5 pb-4" onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<View className="items-center pt-10"><Text className="mb-2 text-5xl">💬</Text><Text className="mb-4 text-center text-slate-500">Ask about meals, macros or your goals. I know your targets and what you've eaten today.</Text>
            {SUGGESTIONS.map((s) => <Pressable key={s} onPress={() => send(s)} className="mb-2 self-stretch rounded-2xl bg-white p-4 dark:bg-slate-900"><Text className="text-slate-800 dark:text-slate-100">{s}</Text></Pressable>)}</View>}
          renderItem={({ item }) => (<View className={`mb-2.5 max-w-[85%] rounded-3xl px-4 py-3 ${item.role === 'USER' ? 'self-end bg-brand' : 'self-start bg-white dark:bg-slate-900'}`}><Text className={`text-base ${item.role === 'USER' ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{item.content}</Text></View>)} />
        {busy ? <View className="px-5 pb-2"><ActivityIndicator color="#16a34a" /></View> : null}
        {err ? <Text className="px-5 pb-2 text-center text-red-500">{err}</Text> : null}
        <View className="flex-row items-end gap-2 border-t border-slate-200 px-4 pb-3 pt-3 dark:border-slate-800">
          <TextInput value={text} onChangeText={setText} placeholder="Ask your coach…" placeholderTextColor="#94a3b8" multiline maxLength={1000} accessibilityLabel="Message" className="max-h-28 min-h-12 flex-1 rounded-2xl bg-white px-4 py-3 text-base text-slate-900 dark:bg-slate-900 dark:text-white" />
          <Pressable onPress={() => send()} disabled={busy || !text.trim()} accessibilityLabel="Send" className={`h-12 w-12 items-center justify-center rounded-full ${busy || !text.trim() ? 'bg-slate-300' : 'bg-brand'}`}><Text className="text-lg text-white">➤</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
