import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, H1, Muted, Screen } from '../components/ui';
import { api } from '../services/api';
import { useSession } from '../store/session';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [code, setCode] = useState(''); const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(useSession.getState().bootError); const [busy, setBusy] = useState(false);
  const refreshMe = useSession((s) => s.refreshMe);

  const submit = async () => {
    setError(null); setInfo(null);
    if (mode === 'forgot' || mode === 'reset') {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
      if (mode === 'reset' && (code.trim().length !== 8 || password.length < 8)) return setError('Enter the 8-character code and a new password of at least 8 characters.');
      setBusy(true);
      try {
        if (mode === 'forgot') { await api.forgotPassword(email.trim()); setInfo('If that email is registered, we sent a reset code. It expires in 30 minutes.'); setMode('reset'); }
        else { await api.resetPassword(email.trim(), code.trim(), password); setPassword(''); setCode(''); setMode('login'); setInfo('Password updated. Log in with your new password.'); }
      } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    try { mode === 'login' ? await api.login(email.trim(), password) : await api.register(email.trim(), password); await refreshMe(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Screen className="justify-center pt-16">
      <View className="mb-10 items-center"><Text className="mb-3 text-6xl">🥗</Text><H1>FitScan AI</H1><Muted className="mt-1 text-center">Snap your meal. Know your macros.</Muted></View>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      {mode === 'reset' ? <Field label="Reset code (from your email)" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={8} placeholder="ABCD2345" /> : null}
      {mode !== 'forgot' ? <Field label={mode === 'reset' ? 'New password' : 'Password'} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" /> : null}
      {info ? <Text className="mb-3 text-center text-brand" accessibilityLiveRegion="polite">{info}</Text> : null}
      {error ? <Text className="mb-3 text-center text-red-500" accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button title={mode === 'login' ? 'Log in' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset code' : 'Set new password'} onPress={submit} loading={busy} />
      {mode === 'login' ? <Button variant="ghost" className="mt-1" title="Forgot password?" onPress={() => { setMode('forgot'); setError(null); setInfo(null); }} /> : null}
      <Button variant="ghost" className="mt-1" title={mode === 'login' ? 'New here? Create an account' : mode === 'register' ? 'Have an account? Log in' : 'Back to log in'} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setInfo(null); }} />
    </Screen>
  );
}
