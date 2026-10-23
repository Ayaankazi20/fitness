import React from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSession } from '../store/session';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import MealsScreen from '../screens/MealsScreen';
import ProgressScreen from '../screens/ProgressScreen';
import CoachScreen from '../screens/CoachScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ScanScreen from '../screens/ScanScreen';
import ReviewMealScreen from '../screens/ReviewMealScreen';
import FoodSearchScreen from '../screens/FoodSearchScreen';
import MealDetailScreen from '../screens/MealDetailScreen';
import { Loading } from '../components/ui';

const Tab = createBottomTabNavigator(); const Stack = createNativeStackNavigator();
const ICON: Record<string, string> = { Home: '🏠', Meals: '📖', Progress: '📈', Coach: '💬', Profile: '👤' };

function Tabs({ navigation }: any) {
  const dark = useColorScheme() === 'dark';
  return (
    <View className="flex-1">
      <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: '#16a34a', tabBarStyle: { backgroundColor: dark ? '#0f172a' : '#fff', borderTopWidth: 0, height: 64, paddingBottom: 8, paddingTop: 6 }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }, tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICON[route.name]}</Text> })}>
        <Tab.Screen name="Home" component={HomeScreen} /><Tab.Screen name="Meals" component={MealsScreen} />
        <Tab.Screen name="Progress" component={ProgressScreen} /><Tab.Screen name="Coach" component={CoachScreen} /><Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      <Pressable onPress={() => navigation.navigate('Scan')} accessibilityRole="button" accessibilityLabel="Scan food" className="absolute bottom-20 right-5 h-16 w-16 items-center justify-center rounded-full bg-brand" style={{ shadowColor: '#16a34a', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
        <Text className="text-3xl">📷</Text>
      </Pressable>
    </View>
  );
}

export default function RootNavigator() {
  const status = useSession((s) => s.status); const scheme = useColorScheme();
  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      {status === 'loading' ? <Loading />
        : status === 'signedOut' ? <AuthScreen />
        : status === 'needsOnboarding' ? <OnboardingScreen />
        : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="Scan" component={ScanScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="ReviewMeal" component={ReviewMealScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="FoodSearch" component={FoodSearchScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="MealDetail" component={MealDetailScreen} options={{ headerShown: true, title: 'Meal', headerBackTitle: 'Back' }} />
          </Stack.Navigator>)}
    </NavigationContainer>
  );
}
