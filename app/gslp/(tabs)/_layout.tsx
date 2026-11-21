import { type ProgramTab, ProgramTabs } from '@/components/program-tabs';

import React from 'react';

const tabs: ProgramTab[] = [
  { name: 'index', title: '', icon: 'circle', hidden: true }, // redirects /gslp to the Workout tab
  { name: 'workouts', title: 'Workout', icon: 'dumbbell' },
  { name: 'history', title: 'History', icon: 'clock.arrow.circlepath' },
  { name: 'exercises', title: 'Exercises', icon: 'list.bullet' },
  { name: 'settings', title: 'Settings', icon: 'gearshape' },
];

export const unstable_settings = {
  initialRouteName: 'workouts',
};

export default function GslpTabLayout() {
  return <ProgramTabs tabs={tabs} initialRouteName="workouts" hideMinibarOn={['workouts']} />;
}
