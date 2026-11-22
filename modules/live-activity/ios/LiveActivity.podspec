Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts, updates and ends the workout Live Activity'
  s.description    = 'Local Expo module: the bridge between lib/live-activity.ts and ActivityKit.'
  s.author         = ''
  s.homepage       = 'https://github.com/lkleinbrodt/lifter'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
