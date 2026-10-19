import { Mic, Square } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AnimatedIcon } from '@/components/AnimatedIcon';
import { colors } from '@/theme/tokens';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const RING = 112;
const STROKE = 4;
const R = (RING - STROKE) / 2 - 2;
const CIRC = 2 * Math.PI * R;

// Кнопка «натисни і говори» з тонким кільцем залишку хвилин (як у макеті).
export function MicButton({
  fraction,
  state,
  disabled,
  onPressIn,
  onPressOut,
  label,
}: {
  fraction: number;
  state: VoiceState;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  label: string;
}) {
  const scale = useState(() => new Animated.Value(1))[0];
  const listening = state === 'listening';

  useEffect(() => {
    Animated.spring(scale, { toValue: listening ? 1.08 : 1, useNativeDriver: true, friction: 5 }).start();
  }, [listening, scale]);

  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.ringWrap}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={colors.cardBorder} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={colors.accent}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRC * clamped} ${CIRC}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled, busy: listening }}
          disabled={disabled}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={[styles.mic, disabled && { opacity: 0.5 }]}
        >
          <AnimatedIcon icon={listening ? Square : Mic} size={34} color={colors.onAccent} animation="pulse" loop={listening} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Індикатор стану над кнопкою: смужки (слухаю / говорить) або крапки (думає).
export function StateIndicator({ state }: { state: VoiceState }) {
  if (state === 'thinking') return <Dots />;
  if (state === 'listening' || state === 'speaking') {
    return <Bars color={state === 'listening' ? colors.accent : colors.text} />;
  }
  return <View style={{ height: 36 }} />;
}

function Bars({ color }: { color: string }) {
  const values = useState(() => [0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0)))[0];
  useEffect(() => {
    const anims = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 300 + i * 70, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 300 + i * 70, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [values]);
  return (
    <View style={styles.indicator} accessibilityElementsHidden>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.bar, { backgroundColor: color, transform: [{ scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}
        />
      ))}
    </View>
  );
}

function Dots() {
  const values = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)))[0];
  useEffect(() => {
    const anims = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(v, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay((2 - i) * 200),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [values]);
  return (
    <View style={[styles.indicator, { gap: 8 }]} accessibilityElementsHidden>
      {values.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: v }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  indicator: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  bar: { width: 4, height: 34, borderRadius: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text },
});
