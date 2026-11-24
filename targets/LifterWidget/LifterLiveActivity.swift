// The workout Live Activity: rest countdown (then a stopwatch since the last set), the next set (with
// plates per side for barbell lifts, lock screen only), and ✓ / +15 / Skip buttons, on the lock
// screen and in the Dynamic Island. Countdowns are timer texts drawn by iOS, so they tick without
// the app running. The app starts, updates and ends it (lib/live-activity.ts).

import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

private enum Palette {
  static let bg = Color(red: 0x0E / 255, green: 0x10 / 255, blue: 0x11 / 255)
  static let raised = Color(red: 0x2A / 255, green: 0x2F / 255, blue: 0x33 / 255)
  static let t1 = Color(red: 0xEC / 255, green: 0xEE / 255, blue: 0xEC / 255)
  static let t2 = t1.opacity(0.62)
  static let t3 = t1.opacity(0.40)
  static let accent = Color(red: 0x9D / 255, green: 0xC1 / 255, blue: 0xAD / 255)
  static let onAccent = bg
}

/// The rest that's still running at render time, if any. Past `restEndsAt` the activity is stale.
private func runningRest(_ state: LifterActivityAttributes.ContentState, stale: Bool) -> ClosedRange<Date>? {
  guard !stale, let end = state.restEndsAt, end > Date() else { return nil }
  let start = min(state.restStartedAt ?? Date(), end)
  return start...end
}

/// The big number: the rest countdown while resting; once rest is over (or skipped), a stopwatch
/// since the last checked set; before the first set, the workout's time.
private enum Clock {
  case rest(ClosedRange<Date>)
  case sinceLastSet(Date)
  case workout(Date)

  init(_ attributes: LifterActivityAttributes, _ state: LifterActivityAttributes.ContentState, stale: Bool) {
    if let rest = runningRest(state, stale: stale) {
      self = .rest(rest)
    } else if let last = state.lastDoneAt {
      self = .sinceLastSet(last)
    } else {
      self = .workout(attributes.startedAt)
    }
  }

  var resting: Bool { if case .rest = self { return true } else { return false } }

  func caption(_ attributes: LifterActivityAttributes) -> String {
    switch self {
    case .rest: return "REST"
    case .sinceLastSet: return "SINCE LAST SET"
    case .workout: return attributes.workoutName.uppercased()
    }
  }
}

/// The clock's time: counts down for rest, up otherwise. iOS draws and ticks it.
private struct ClockText: View {
  let clock: Clock
  var size: CGFloat = 34

  var body: some View {
    Group {
      switch clock {
      case .rest(let range):
        Text(timerInterval: range, countsDown: true).foregroundStyle(Palette.t1)
      case .sinceLastSet(let date):
        Text(date, style: .timer).foregroundStyle(Palette.accent)
      case .workout(let date):
        Text(date, style: .timer).foregroundStyle(Palette.t2)
      }
    }
    .font(.system(size: size, weight: .semibold, design: .monospaced))
    .monospacedDigit()
  }
}

struct LifterLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LifterActivityAttributes.self) { context in
      LockScreenView(attributes: context.attributes, state: context.state, stale: context.isStale)
        .activityBackgroundTint(Palette.bg)
        .activitySystemActionForegroundColor(Palette.t1)
    } dynamicIsland: { context in
      let state = context.state
      let clock = Clock(context.attributes, state, stale: context.isStale)
      let rest = runningRest(state, stale: context.isStale)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Caption(clock.caption(context.attributes))
            ClockText(clock: clock, size: 30)
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if clock.resting {
            RestButtons()
              .padding(.trailing, 4)
              .frame(maxHeight: .infinity)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          NextSetRow(state: state)
            .padding(.horizontal, 4)
        }
      } compactLeading: {
        Image(systemName: "dumbbell.fill")
          .foregroundStyle(Palette.accent)
      } compactTrailing: {
        if let rest {
          Text(timerInterval: rest, countsDown: true)
            .monospacedDigit()
            .frame(width: 44)
            .foregroundStyle(Palette.accent)
        } else if let last = state.lastDoneAt {
          Text(last, style: .timer)
            .monospacedDigit()
            .frame(width: 44)
            .foregroundStyle(Palette.accent)
        } else {
          Text("\(state.doneSets)/\(state.totalSets)")
            .monospacedDigit()
            .foregroundStyle(Palette.t2)
        }
      } minimal: {
        if let rest {
          Text(timerInterval: rest, countsDown: true)
            .monospacedDigit()
            .frame(width: 36)
            .font(.system(size: 12))
            .foregroundStyle(Palette.accent)
        } else {
          Image(systemName: "dumbbell.fill")
            .foregroundStyle(Palette.accent)
        }
      }
      .keylineTint(Palette.accent)
    }
  }
}

private struct LockScreenView: View {
  let attributes: LifterActivityAttributes
  let state: LifterActivityAttributes.ContentState
  let stale: Bool

  var body: some View {
    let clock = Clock(attributes, state, stale: stale)
    // A plate row costs a line; tighten everything else so the card stays under iOS's 160pt cap.
    let dense = state.next?.plates != nil
    VStack(alignment: .leading, spacing: dense ? 8 : 12) {
      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: dense ? 0 : 2) {
          Caption(clock.caption(attributes))
          ClockText(clock: clock, size: dense ? 28 : 34)
        }
        Spacer(minLength: 0)
        if clock.resting {
          RestButtons()
        } else {
          Text("\(state.doneSets)/\(state.totalSets)")
            .font(.system(size: 17, weight: .medium, design: .monospaced))
            .foregroundStyle(Palette.t2)
        }
      }
      if case .rest(let rest) = clock {
        ProgressView(timerInterval: rest, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
          .progressViewStyle(.linear)
          .tint(Palette.accent)
      }
      NextSetRow(state: state, showPlates: true)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, dense ? 12 : 16)
  }
}

private struct NextSetRow: View {
  let state: LifterActivityAttributes.ContentState
  /// Lock screen only: the Dynamic Island has no room for the plate row.
  var showPlates = false

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      if let next = state.next {
        if showPlates, let plates = next.plates {
          // Barbell set: name and numbers share a line, plates below.
          VStack(alignment: .leading, spacing: 1) {
            Caption("NEXT · \(next.detail.uppercased())")
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Text(next.name)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Palette.t1)
                .lineLimit(1)
              Text(next.numbers)
                .font(.system(size: 15, design: .monospaced))
                .foregroundStyle(Palette.t2)
                .lineLimit(1)
                .layoutPriority(1)
            }
            PlateBar(plates: plates)
              .padding(.top, 4)
          }
        } else {
          VStack(alignment: .leading, spacing: 2) {
            Caption("NEXT · \(next.detail.uppercased())")
            Text(next.name)
              .font(.system(size: 17, weight: .semibold))
              .foregroundStyle(Palette.t1)
              .lineLimit(1)
            Text(next.numbers)
              .font(.system(size: 15, design: .monospaced))
              .foregroundStyle(Palette.t2)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 0)
        if next.canCheck {
          Button(intent: LifterCheckSetIntent(setId: next.setId)) {
            Image(systemName: "checkmark")
              .font(.system(size: 20, weight: .bold))
              .foregroundStyle(Palette.onAccent)
              .frame(width: 52, height: 44)
              .background(Palette.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
          }
          .buttonStyle(.plain)
        }
      } else {
        Text("All sets done")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(Palette.accent)
        Spacer(minLength: 0)
      }
    }
  }
}

/// One side of the bar, loaded: the workout card's plate diagram (components/workout/plate-diagram.tsx), scaled down.
private struct PlateBar: View {
  let plates: [Double]

  private static let specs: [Double: (height: CGFloat, color: Color)] = [
    45: (24, Color(red: 0x4B / 255, green: 0x52 / 255, blue: 0x58 / 255)),
    35: (22, Color(red: 0x46 / 255, green: 0x4D / 255, blue: 0x53 / 255)),
    25: (20, Color(red: 0x41 / 255, green: 0x48 / 255, blue: 0x4D / 255)),
    10: (17, Color(red: 0x59 / 255, green: 0x60 / 255, blue: 0x66 / 255)),
    5: (15, Color(red: 0x61 / 255, green: 0x68 / 255, blue: 0x6E / 255)),
    2.5: (14, Color(red: 0x6A / 255, green: 0x71 / 255, blue: 0x77 / 255)),
    1.25: (14, Color(red: 0x72 / 255, green: 0x79 / 255, blue: 0x7F / 255)),
  ]

  private static func label(_ plate: Double) -> String {
    plate == plate.rounded() ? String(Int(plate)) : String(plate)
  }

  var body: some View {
    HStack(spacing: 2) {
      RoundedRectangle(cornerRadius: 1).fill(Palette.t1.opacity(0.2)).frame(width: 14, height: 4)
      RoundedRectangle(cornerRadius: 1.5).fill(Palette.t3).frame(width: 4, height: 10)
      if plates.isEmpty {
        Text("empty bar")
          .font(.system(size: 11))
          .foregroundStyle(Palette.t3)
          .padding(.leading, 4)
      } else {
        ForEach(Array(plates.enumerated()), id: \.offset) { _, plate in
          let spec = Self.specs[plate] ?? (height: 14, color: Color(red: 0x72 / 255, green: 0x79 / 255, blue: 0x7F / 255))
          Text(Self.label(plate))
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(Palette.t1)
            .padding(.horizontal, 3)
            .frame(minWidth: 18, minHeight: spec.height, maxHeight: spec.height)
            .background(spec.color, in: RoundedRectangle(cornerRadius: 3))
        }
        UnevenRoundedRectangle(bottomTrailingRadius: 2, topTrailingRadius: 2)
          .fill(Palette.t1.opacity(0.2))
          .frame(width: 9, height: 4)
        Text("per side")
          .font(.system(size: 11))
          .foregroundStyle(Palette.t3)
          .padding(.leading, 6)
          .lineLimit(1)
      }
    }
    .frame(height: 24)
  }
}

private struct RestButtons: View {
  var body: some View {
    HStack(spacing: 8) {
      Button(intent: LifterAddRestIntent()) {
        Text("+15")
          .font(.system(size: 15, weight: .semibold, design: .monospaced))
          .foregroundStyle(Palette.t1)
          .frame(width: 52, height: 36)
          .background(Palette.raised, in: Capsule())
      }
      .buttonStyle(.plain)
      Button(intent: LifterSkipRestIntent()) {
        Text("Skip")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(Palette.onAccent)
          .frame(width: 56, height: 36)
          .background(Palette.accent, in: Capsule())
      }
      .buttonStyle(.plain)
    }
  }
}

private struct Caption: View {
  let text: String
  init(_ text: String) { self.text = text }

  var body: some View {
    Text(text)
      .font(.system(size: 11, weight: .semibold))
      .kerning(0.6)
      .foregroundStyle(Palette.t3)
      .lineLimit(1)
  }
}
