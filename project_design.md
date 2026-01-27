***

# Project Specification: Simple 5/3/1 Calculator

## 1. Project Overview
**Goal:** Build a simple iOS app using React Native (Expo) to calculate and display 5/3/1 weightlifting sets based on user-inputted One Rep Maxes (1RM).
**Core Functionality:**
1.  Input 1RMs to calculate Training Maxes (90% of 1RM).
2.  Select a specific workout (Week + Lift) to view the required weights and reps.
3.  Mark workouts as "Complete" to track progress within the cycle.

## 2. Tech Stack
*   **Framework:** React Native with Expo (Managed Workflow).
*   **Language:** TypeScript (preferred for fewer bugs) or JavaScript.
*   **Navigation:** React Navigation (Bottom Tab Navigator).
*   **State/Storage:** `AsyncStorage` (to persist 1RMs and Completed sessions across app restarts).
*   **Styling:** StyleSheet or Tailwind (NativeWind) - keep it clean and minimal.

## 3. Data Structure

### A. The 3 Main Lifts
We will support:
1.  Squat
2.  Bench Press
3.  Deadlift

### B. Storage Keys (AsyncStorage)
1.  `@user_maxes`: JSON Object storing the *One Rep Max* (1RM).
    ```json
    {
      "squat": 315,
      "bench": 225,
      "deadlift": 405
    }
    ```
2.  `@completed_workouts`: Array of strings identifying finished sessions.
    *   Format: `"{week_number}-{lift_name}"` (e.g., `"1-bench"`, `"3-squat"`).

## 4. Business Logic (The Math)

### A. Training Max (TM)
*   `TM = 1RM * 0.90`
*   All workout calculations are based on the **TM**, not the 1RM.

### B. Rounding
*   All calculated weights must round to the nearest **5 lbs** (standard gym plate math).
*   *Formula:* `Math.round(weight / 5) * 5`

### C. The Weeks & Percentages
**Week 1 (5/5/5):**
*   Set 1: 65% of TM x 5 reps
*   Set 2: 75% of TM x 5 reps
*   Set 3: 85% of TM x 5+ reps (AMRAP)

**Week 2 (3/3/3):**
*   Set 1: 70% of TM x 3 reps
*   Set 2: 80% of TM x 3 reps
*   Set 3: 90% of TM x 3+ reps (AMRAP)

**Week 3 (5/3/1):**
*   Set 1: 75% of TM x 5 reps
*   Set 2: 85% of TM x 3 reps
*   Set 3: 95% of TM x 1+ reps (AMRAP)

**Week 4 (Deload):**
*   Set 1: 40% of TM x 5 reps
*   Set 2: 50% of TM x 5 reps
*   Set 3: 60% of TM x 5 reps

## 5. UI Specifications

### App Navigation
Two Bottom Tabs:
1.  **Settings / Maxes** (Label: "Maxes")
2.  **Workout Plan** (Label: "Workouts")

### Tab 1: Maxes Screen
*   **Header:** "One Rep Maxes".
*   **Inputs:** 3 Numeric Input fields (Squat, Bench, Deadlift).
*   **Display:** Below each input, show the calculated **Training Max** (90%) in smaller text so the user knows what number the app is using.
*   **Action:** Values should save automatically `onBlur` or via a "Save" button.

### Tab 2: Workouts Screen
*   **Header:** "Select Workout".
*   **Layout:** A ScrollView showing a list of clickable cards/buttons.
*   **Organization:** Grouped by Week (Week 1, Week 2, Week 3, Week 4).
*   **Content:** Inside each Week, list the 3 lifts.
    *   *Example Item:* "Week 1 - Bench Press"
*   **State Visualization:**
    *   If a workout is in the `@completed_workouts` list, the card should be **greyed out** or have a green **Checkmark** icon.
    *   If active, it should be bold/colored.

### The "Active Workout" View (Modal or separate screen)
*   When a user clicks an incomplete workout (e.g., "Week 1 - Bench"):
    *   Show Title: "Week 1 - Bench Press"
    *   Show Training Max being used.
    *   **The Table:**
        *   Row 1: Weight (Calculated) x Reps
        *   Row 2: Weight (Calculated) x Reps
        *   Row 3: Weight (Calculated) x Reps (highlight if AMRAP "+")
    *   **Action:** A large "Complete Session" button.
        *   *Function:* Adds ID to `@completed_workouts`, saves to storage, and navigates back to the list.

### Reset Mechanism (Optional but recommended)
*   Add a small "Start New Cycle" button on the Maxes screen that clears the `@completed_workouts` array so the user can start over next month.

## 6. Edge Cases for the Coder
*   Ensure the keyboard dismisses when tapping outside inputs.
*   Default inputs to `0` if empty to avoid `NaN` errors.
*   Ensure text inputs only accept numeric values.