// Widget extension for the workout Live Activity (lock screen + Dynamic Island).
// Generated into ios/ by @bacons/apple-targets at prebuild. Files in _shared/ are compiled into
// both this extension and the app, so the activity's types and its App Intents exist in both.
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  bundleIdentifier: '.widget',
  displayName: 'Lifter',
  deploymentTarget: '17.0', // Live Activity buttons (App Intents) need iOS 17
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AppIntents'],
  colors: {
    $accent: '#9DC1AD',
    $widgetBackground: '#0E1011',
  },
};
