import { type ProgramTab, ProgramTabs } from '@/components/program-tabs';

import React from 'react';

const tabs: ProgramTab[] = [
  { name: 'index', title: 'Weights', icon: 'gauge.medium' },
  { name: 'workouts', title: 'Workouts', icon: 'checklist.checked' },
  { name: 'exercises', title: 'Exercises', icon: 'list.bullet' },
];

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function GslpTabLayout() {
  return <ProgramTabs basePath="/gslp" lastTabKey="@gslp_last_tab" tabs={tabs} />;
}
