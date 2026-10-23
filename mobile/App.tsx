import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation/RootNavigator';
import { useSession } from './store/session';

export default function App() {
  const boot = useSession((s) => s.boot);
  useEffect(() => { boot(); }, [boot]);
  return (<SafeAreaProvider><StatusBar style="auto" /><RootNavigator /></SafeAreaProvider>);
}
