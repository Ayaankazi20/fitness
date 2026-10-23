import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { Button, H2, Muted } from '../components/ui';
import { api, ApiError } from '../services/api';
import { useDraft } from '../store/draft';

const STAGES = ['Uploading image…', 'Analyzing food…', 'Identifying portions…', 'Finding nutrition…', 'Calculating calories…'];

/** Maps backend / network failures to a friendly message plus recovery actions (Try Again / Enter Manually). */
function describe(e: unknown): { title: string; body: string } {
  const err = e instanceof ApiError ? e : null;
  switch (err?.code) {
    case 'NO_FOOD_DETECTED': return { title: "We couldn't find food in this photo", body: 'Try a closer, well-lit shot from above, or enter your meal manually.' };
    case 'IMAGE_TOO_LARGE': return { title: 'Photo is too large', body: 'Try a smaller photo or take a new one.' };
    case 'INVALID_IMAGE': case 'IMAGE_TOO_SMALL': return { title: "We can't use this image", body: err.message };
    case 'AI_TIMEOUT': case 'TIMEOUT': return { title: 'This is taking too long', body: 'The analysis timed out. Please try again.' };
    case 'AI_FAILURE': case 'AI_BUSY': case 'AI_INVALID_RESPONSE': return { title: "We couldn't confidently identify your meal", body: 'The AI service had trouble with this photo. Try again or enter manually.' };
    case 'NETWORK': return { title: "You're offline", body: "Can't reach the server. Check your connection and try again." };
    case 'QUOTA_EXCEEDED': return { title: 'Monthly scan limit reached', body: err.message };
    case 'RATE_LIMITED': return { title: 'Slow down a little', body: err.message };
    default: return { title: 'Something went wrong', body: err?.message ?? 'Please try again.' };
  }
}

export default function ScanScreen() {
  const nav = useNavigation<any>();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [failure, setFailure] = useState<{ title: string; body: string; quota?: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const busy = !!uri && !failure;
  const loadScan = useDraft((s) => s.loadScan), startManual = useDraft((s) => s.startManual);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(t);
  }, [busy]);

  const analyze = async (u: string, mime?: string) => {
    setUri(u); setFailure(null); setStage(0);
    try { const r = await api.analyze(u, mime); loadScan(r); nav.replace('ReviewMeal'); }
    catch (e) { const d = describe(e); setFailure({ ...d, quota: e instanceof ApiError && e.code === 'QUOTA_EXCEEDED' }); }
  };
  const capture = async () => {
    if (!cam.current || !ready) return;
    try { const p = await cam.current.takePictureAsync({ quality: 0.7, skipProcessing: false }); if (p?.uri) await analyze(p.uri, 'image/jpeg'); }
    catch { setFailure({ title: "Couldn't take the photo", body: 'Please try again.' }); setUri('x'); }
  };
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false });
    if (!r.canceled && r.assets[0]) await analyze(r.assets[0].uri, r.assets[0].mimeType ?? 'image/jpeg');
  };
  const manual = () => { startManual(); nav.replace('ReviewMeal'); };

  if (uri) {
    return (
      <View className="flex-1 bg-slate-950">
        {uri !== 'x' ? <Image source={{ uri }} className="absolute h-full w-full opacity-40" resizeMode="cover" /> : null}
        <View className="flex-1 items-center justify-center px-8">
          {failure ? (
            <View className="w-full rounded-3xl bg-white p-6 dark:bg-slate-900">
              <Text className="mb-2 text-center text-4xl">😕</Text>
              <H2 className="mb-1 text-center">{failure.title}</H2>
              <Muted className="mb-5 text-center">{failure.body}</Muted>
              {!failure.quota ? <Button title="Try again" onPress={() => { setUri(null); setFailure(null); }} className="mb-2" /> : null}
              <Button title="Enter manually" variant="secondary" onPress={manual} />
              <Button title="Cancel" variant="ghost" onPress={() => nav.goBack()} />
            </View>
          ) : (
            <View className="items-center" accessibilityLiveRegion="polite">
              <ActivityIndicator size="large" color="#4ade80" />
              <Text className="mt-5 text-xl font-bold text-white">{STAGES[stage]}</Text>
              <View className="mt-4 flex-row gap-1.5">{STAGES.map((_, i) => <View key={i} className={`h-1.5 w-8 rounded-full ${i <= stage ? 'bg-green-400' : 'bg-white/25'}`} />)}</View>
              <Text className="mt-3 text-sm text-white/70">Hang tight, this takes a few seconds</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (!perm) return <View className="flex-1 bg-slate-950" />;
  if (!perm.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-8 dark:bg-slate-950">
        <Text className="mb-3 text-5xl">📷</Text><H2 className="mb-1 text-center">Camera access needed</H2>
        <Muted className="mb-6 text-center">Allow the camera to photograph your meals, or pick a photo from your gallery instead.</Muted>
        <Button title={perm.canAskAgain ? 'Allow camera' : 'Open settings'} onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} className="mb-2 self-stretch" />
        <Button title="Choose from gallery" variant="secondary" onPress={pick} className="mb-2 self-stretch" />
        <Button title="Enter manually" variant="ghost" onPress={manual} />
      </View>
    );
  }
  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cam} style={{ flex: 1 }} facing="back" onCameraReady={() => setReady(true)} />
      <View pointerEvents="none" className="absolute inset-x-10 top-32 h-72 rounded-3xl border-2 border-white/60" />
      <Text className="absolute inset-x-0 top-14 text-center text-base font-semibold text-white">Fit the whole plate in the frame</Text>
      <Pressable onPress={() => nav.goBack()} accessibilityLabel="Close" className="absolute left-5 top-12 h-10 w-10 items-center justify-center rounded-full bg-black/50"><Text className="text-xl text-white">✕</Text></Pressable>
      <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-around bg-black/60 pb-10 pt-5">
        <Pressable onPress={pick} accessibilityLabel="Choose from gallery" className="w-24 items-center"><Text className="text-3xl">🖼️</Text><Text className="mt-1 text-xs text-white">Gallery</Text></Pressable>
        <Pressable onPress={capture} disabled={!ready} accessibilityLabel="Take photo" className="h-20 w-20 items-center justify-center rounded-full border-4 border-white"><View className={`h-16 w-16 rounded-full ${ready ? 'bg-white' : 'bg-white/40'}`} /></Pressable>
        <Pressable onPress={manual} accessibilityLabel="Enter manually" className="w-24 items-center"><Text className="text-3xl">⌨️</Text><Text className="mt-1 text-xs text-white">Manual</Text></Pressable>
      </View>
    </View>
  );
}
