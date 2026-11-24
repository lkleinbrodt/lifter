// Shared by the app and the widget extension (apple-targets links _shared/ into both).
//
// The Live Activity's data, and the App Intents behind its buttons. A LiveActivityIntent always
// runs in the app's process (iOS launches the app in the background if it isn't running), so
// perform() can queue the action for the JS side and update the activity right away.
//
// modules/live-activity/ios/LiveActivityModule.swift keeps an identical copy of
// LifterActivityAttributes and LifterNextSet: ActivityKit matches attributes by type name, and the
// Expo module is compiled in its own pod, which can't see this file. Keep the two in sync.

import ActivityKit
import AppIntents
import Foundation

/// One set as the activity shows it: "Bench Press", "set 2", "160 × 5".
struct LifterNextSet: Codable, Hashable {
  var setId: String
  var name: String
  var detail: String
  var numbers: String
  /// False when the set needs input first (an AMRAP set, or no numbers yet): no ✓ button.
  var canCheck: Bool
  /// Barbell sets only: plates per side, heaviest first (empty = just the bar).
  var plates: [Double]? = nil
}

@available(iOS 16.1, *)
struct LifterActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var restEndsAt: Date?
    var restStartedAt: Date?
    /// When the latest set was checked: the "since last set" stopwatch once rest is over.
    var lastDoneAt: Date?
    /// The set to do now; nil once every set is checked.
    var next: LifterNextSet?
    /// What comes after `next`, and the rest checking it starts (0 = none), so a ✓ from the
    /// lock screen can show the new state before the app has caught up.
    var afterCheck: LifterNextSet?
    var afterCheckRestSec: Int
    var doneSets: Int
    var totalSets: Int
  }

  var workoutName: String
  var startedAt: Date
}

/// Actions from the activity's buttons, queued in UserDefaults for the JS side to apply
/// (lib/live-activity.ts drains them when it's notified, and on launch / resume).
enum LifterActivityActions {
  static let defaultsKey = "LifterLiveActivityActions"
  static let notification = Notification.Name("LifterLiveActivityAction")

  static func enqueue(_ action: [String: String]) {
    guard let data = try? JSONSerialization.data(withJSONObject: action),
          let json = String(data: data, encoding: .utf8) else { return }
    let defaults = UserDefaults.standard
    var queue = defaults.stringArray(forKey: defaultsKey) ?? []
    queue.append(json)
    defaults.set(queue, forKey: defaultsKey)
    NotificationCenter.default.post(name: notification, object: nil)
  }

  @available(iOS 16.2, *)
  static func update(_ change: (inout LifterActivityAttributes.ContentState) -> Void) async {
    for activity in Activity<LifterActivityAttributes>.activities {
      var state = activity.content.state
      change(&state)
      await activity.update(ActivityContent(state: state, staleDate: state.restEndsAt))
    }
  }
}

@available(iOS 17.0, *)
struct LifterCheckSetIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Check Set"
  static var isDiscoverable = false

  @Parameter(title: "Set ID") var setId: String

  init() {}
  init(setId: String) { self.setId = setId }

  func perform() async throws -> some IntentResult {
    LifterActivityActions.enqueue(["type": "check", "setId": setId])
    let now = Date()
    await LifterActivityActions.update { state in
      guard state.next?.setId == setId else { return }
      state.doneSets += 1
      state.lastDoneAt = now
      state.next = state.afterCheck
      state.afterCheck = nil
      if state.afterCheckRestSec > 0 {
        state.restStartedAt = now
        state.restEndsAt = now.addingTimeInterval(TimeInterval(state.afterCheckRestSec))
      } else {
        state.restStartedAt = nil
        state.restEndsAt = nil
      }
      state.afterCheckRestSec = 0
    }
    return .result()
  }
}

@available(iOS 17.0, *)
struct LifterAddRestIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Add 15 Seconds of Rest"
  static var isDiscoverable = false

  init() {}

  func perform() async throws -> some IntentResult {
    LifterActivityActions.enqueue(["type": "addRest", "seconds": "15"])
    await LifterActivityActions.update { state in
      if let end = state.restEndsAt, end > Date() { state.restEndsAt = end.addingTimeInterval(15) }
    }
    return .result()
  }
}

@available(iOS 17.0, *)
struct LifterSkipRestIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Skip Rest"
  static var isDiscoverable = false

  init() {}

  func perform() async throws -> some IntentResult {
    LifterActivityActions.enqueue(["type": "skipRest"])
    await LifterActivityActions.update { state in
      state.restEndsAt = nil
      state.restStartedAt = nil
    }
    return .result()
  }
}
