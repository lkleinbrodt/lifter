import { Redirect } from 'expo-router';

// /gslp opens the Workout tab.
export default function GslpIndex() {
  return <Redirect href="/gslp/workouts" />;
}
