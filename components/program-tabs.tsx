import { Colors, Fonts } from '@/constants/theme';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticTab } from '@/components/haptic-tab';

export type ProgramTab = {
  name: string;
  title: string;
  icon: IconSymbolName;
};

type ProgramTabsProps = {
  basePath: '/531' | '/gslp';
  lastTabKey: string; // AsyncStorage key remembering the last viewed tab for this program
  tabs: ProgramTab[];
};

export function ProgramTabs({ basePath, lastTabKey, tabs }: ProgramTabsProps) {
  const router = useRouter();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    AsyncStorage.getItem(lastTabKey).then((tab) => {
      if (tab && tab !== 'index' && tabs.some((item) => item.name === tab)) {
        router.replace(`${basePath}/${tab}` as never);
      }
    });
  }, [basePath, lastTabKey, router, tabs]);

  return (
    <Tabs
      initialRouteName="index"
      screenListeners={({ route }) => ({
        focus: () => {
          AsyncStorage.setItem(lastTabKey, route.name);
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
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.tabItem}>
                <View style={[styles.indicator, focused && styles.indicatorActive]} />
                <IconSymbol size={26} name={tab.icon} color={focused ? Colors.dark.tint : color} />
              </View>
            ),
          }}
        />
      ))}
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
