// Bridge between lib/live-activity.ts and ActivityKit: start / update / end the workout Live
// Activity, and hand the JS side the actions queued by the activity's buttons.
//
// LifterActivityAttributes and LifterNextSet are copies of the ones in
// targets/LifterWidget/_shared/LifterActivityShared.swift (ActivityKit matches attributes by type
// name; this pod can't see the app target's files). Keep the two in sync.

import ActivityKit
import ExpoModulesCore
import Foundation

struct LifterNextSet: Codable, Hashable {
  var setId: String
  var name: String
  var detail: String
  var numbers: String
  var canCheck: Bool
  /// Barbell sets only: plates per side, heaviest first (empty = just the bar).
  var plates: [Double]? = nil
}

@available(iOS 16.1, *)
struct LifterActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var restEndsAt: Date?
    var restStartedAt: Date?
    var lastDoneAt: Date?
    var next: LifterNextSet?
    var afterCheck: LifterNextSet?
    var afterCheckRestSec: Int
    var doneSets: Int
    var totalSets: Int
  }

  var workoutName: String
  var startedAt: Date
}

/// What lib/live-activity.ts sends: dates are epoch milliseconds.
@available(iOS 16.1, *)
private struct SyncPayload: Decodable {
  var attributes: LifterActivityAttributes
  var state: LifterActivityAttributes.ContentState
}

// Same names as LifterActivityActions in the shared file.
private let actionsKey = "LifterLiveActivityActions"
private let actionNotification = Notification.Name("LifterLiveActivityAction")

public class LiveActivityModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    Events("onAction")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(forName: actionNotification, object: nil, queue: .main) {
        [weak self] _ in
        self?.sendEvent("onAction", [:])
      }
    }

    OnStopObserving {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }

    Function("isSupported") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    /// Updates the running activity, or starts one (ending any for another workout).
    AsyncFunction("sync") { (json: String) async throws in
      guard #available(iOS 16.2, *) else { return }
      let decoder = JSONDecoder()
      decoder.dateDecodingStrategy = .millisecondsSince1970
      let payload = try decoder.decode(SyncPayload.self, from: Data(json.utf8))
      let content = ActivityContent(state: payload.state, staleDate: payload.state.restEndsAt)

      var updated = false
      for activity in Activity<LifterActivityAttributes>.activities {
        let sameWorkout = abs(activity.attributes.startedAt.timeIntervalSince(payload.attributes.startedAt)) < 1
        if !updated && sameWorkout && activity.activityState == .active {
          await activity.update(content)
          updated = true
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      if !updated && ActivityAuthorizationInfo().areActivitiesEnabled {
        // Only allowed while the app is in the foreground; a later sync retries.
        _ = try? Activity.request(attributes: payload.attributes, content: content, pushType: nil)
      }
    }

    AsyncFunction("end") { () async in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<LifterActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }

    /// Button actions queued since the last call, oldest first, as JSON strings. Clears the queue.
    Function("takePendingActions") { () -> [String] in
      let defaults = UserDefaults.standard
      let queue = defaults.stringArray(forKey: actionsKey) ?? []
      defaults.removeObject(forKey: actionsKey)
      return queue
    }
  }
}
