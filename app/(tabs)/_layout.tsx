import { Colors, Fonts } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React, { useEffect, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';

const LAST_TAB_KEY = '@last_tab';
const VALID_TABS = ['index', 'workouts', 'exercises'];

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const router = useRouter();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    AsyncStorage.getItem(LAST_TAB_KEY).then((tab) => {
      if (tab && VALID_TABS.includes(tab) && tab !== 'index') {
        router.replace(`/(tabs)/${tab}` as never);
      }
    });
  }, []);

  return (
    <Tabs
      initialRouteName="index"
      screenListeners={({ route }) => ({
        focus: () => {
          AsyncStorage.setItem(LAST_TAB_KEY, route.name);
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Colors.dark.surface,
          borderTopColor: Colors.dark.border,
          height: 88,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.dark.tint,
        tabBarInactiveTintColor: Colors.dark.icon,
        tabBarLabelStyle: {
          fontFamily: Fonts.family,
          fontSize: 10,
          marginTop: 4,
        },
        tabBarItemStyle: {
          borderRadius: 12,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Maxes',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabItem, focused && styles.tabItemActive]}>
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
              <IconSymbol size={26} name="gauge.medium" color={focused ? Colors.dark.tint : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabItem, focused && styles.tabItemActive]}>
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
              <IconSymbol
                size={26}
                name="checklist.checked"
                color={focused ? Colors.dark.tint : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabItem, focused && styles.tabItemActive]}>
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
              <IconSymbol
                size={26}
                name="list.bullet"
                color={focused ? Colors.dark.tint : color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabItemActive: {
    // backgroundColor: Colors.dark.tintMuted,

  },
  indicator: {
    width: 24,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: Colors.dark.tint,
  },
});
