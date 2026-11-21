import { C, Fonts } from '@/constants/theme';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';

import { ActiveWorkoutBar } from '@/components/workout/active-workout-bar';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { HapticTab } from '@/components/haptic-tab';

export type ProgramTab = {
  name: string;
  title: string;
  icon: IconSymbolName;
  /** A route in the group that isn't a tab (e.g. an index that redirects). */
  hidden?: boolean;
};

type ProgramTabsProps = {
  tabs: ProgramTab[];
  /** The tab the program opens on (cold start always lands here). */
  initialRouteName: string;
  /** Tabs that show the workout in progress themselves, so the minibar hides there. */
  hideMinibarOn?: string[];
};

export function ProgramTabs({ tabs, initialRouteName, hideMinibarOn = [] }: ProgramTabsProps) {
  return (
    <Tabs
      initialRouteName={initialRouteName}
      tabBar={(props) => {
        const routeName = props.state.routes[props.state.index]?.name;
        return (
          <View>
            {hideMinibarOn.includes(routeName) ? null : <ActiveWorkoutBar />}
            <BottomTabBar {...props} />
          </View>
        );
      }}
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: C.accentHi,
        tabBarInactiveTintColor: C.t3,
        tabBarLabelStyle: styles.label,
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={
            tab.hidden
              ? { href: null }
              : {
                  title: tab.title,
                  tabBarIcon: ({ color }) => <IconSymbol size={25} name={tab.icon} color={color} />,
                }
          }
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(20,23,25,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    height: 84,
    paddingTop: 8,
    elevation: 0,
  },
  label: {
    fontFamily: Fonts.text,
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },
});
