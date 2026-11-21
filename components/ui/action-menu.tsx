// A small pull-down menu anchored to the button that opened it, in the app's own style
// (instead of the system action sheet).

import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import React, { useEffect } from "react";
import * as Haptics from "expo-haptics";

import { C, Shadows } from "@/constants/theme";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { ThemedText } from "@/components/themed-text";

export type MenuAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MenuItem = {
  label: string;
  icon?: IconSymbolName;
  destructive?: boolean;
  onPress: () => void;
};

export type MenuState = {
  anchor: MenuAnchor;
  title?: string;
  items: MenuItem[];
};

const MENU_WIDTH = 240;
const ROW_HEIGHT = 48;

/** Measures a view in window coordinates, for anchoring a menu to it. */
export function measureAnchor(
  view: View | null,
  open: (anchor: MenuAnchor) => void,
) {
  view?.measureInWindow((x, y, width, height) => open({ x, y, width, height }));
}

export function ActionMenu({
  menu,
  onClose,
}: {
  menu: MenuState | null;
  onClose: () => void;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (menu) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: reduceMotion ? 120 : 170,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [menu, progress, reduceMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  if (!menu) return null;

  const { anchor, title, items } = menu;
  const height = items.length * ROW_HEIGHT + (title ? 36 : 0);
  const right = Math.max(12, screenW - (anchor.x + anchor.width) - 4);
  const below = anchor.y + anchor.height + 6 + height < screenH - 40;
  const position = below
    ? { top: anchor.y + anchor.height + 6 }
    : { bottom: screenH - anchor.y + 6 };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityLabel="Close menu"
      />
      <Animated.View
        style={[
          styles.menu,
          {
            right,
            ...position,
            transformOrigin: below ? "top right" : "bottom right",
          },
          animated,
        ]}
        accessibilityRole="menu"
      >
        <View style={styles.clip}>
          {title ? (
            <ThemedText style={styles.title} numberOfLines={1}>
              {title}
            </ThemedText>
          ) : null}
          {items.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => {
                void Haptics.selectionAsync();
                onClose();
                // Let the menu close before an alert or sheet opens.
                setTimeout(item.onPress, 60);
              }}
              style={({ pressed }) => [
                styles.row,
                (index > 0 || !!title) && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="menuitem"
            >
              <ThemedText
                style={[styles.label, item.destructive && styles.destructive]}
              >
                {item.label}
              </ThemedText>
              {item.icon ? (
                <IconSymbol
                  name={item.icon}
                  size={17}
                  color={item.destructive ? C.destructive : C.t2}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.28)' },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 14,
    ...Shadows.float, // on the unclipped outer view, or iOS clips the shadow
  },
  clip: {
    borderRadius: 14,
    backgroundColor: "#23282B",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  title: {
    height: 36,
    lineHeight: 36,
    paddingHorizontal: 16,
    fontSize: 13,
    color: C.t3,
  },
  row: {
    height: ROW_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  label: { fontSize: 16, color: C.t1 },
  destructive: { color: C.destructive },
});
