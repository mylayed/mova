import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { colors } from '@/theme/tokens';

// Іконки Lucide з мікроанімаціями в дусі lucide-animated.com. Сам lucide-animated працює лише
// у вебі (DOM + Motion), тож ті самі іконки беремо з lucide-react-native, а анімації
// відтворюємо через Animated з React Native (працює в Expo Go, на iOS, Android і вебі).
export type IconAnimation = 'bounce' | 'wiggle' | 'pulse' | 'pop' | 'none';

type Props = {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
  animation?: IconAnimation;
  // Анімація програється щоразу, коли змінюється це значення (вкладку обрано, кнопку натиснуто).
  trigger?: unknown;
  // Безперервна анімація (наприклад, пульсація мікрофона під час запису).
  loop?: boolean;
};

export function AnimatedIcon({
  icon: Icon,
  size = 24,
  color = colors.text,
  strokeWidth = 2,
  animation = 'bounce',
  trigger,
  loop = false,
}: Props) {
  const progress = useState(() => new Animated.Value(0))[0];
  const first = useRef(true);

  useEffect(() => {
    // Не анімуємо при першій появі — лише на зміну trigger або в циклі.
    if (first.current && !loop) {
      first.current = false;
      return;
    }
    if (animation === 'none') return;
    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: animation === 'pulse' ? 1200 : 450,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const anim = loop ? Animated.loop(run) : run;
    anim.start();
    return () => anim.stop();
  }, [trigger, loop, animation, progress]);

  const transform = (() => {
    switch (animation) {
      case 'bounce':
        return [{ translateY: progress.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0, -4, 1, 0] }) }];
      case 'wiggle':
        return [{ rotate: progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-12deg', '10deg', '-6deg', '0deg'] }) }];
      case 'pulse':
        return [{ scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] }) }];
      case 'pop':
        return [{ scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.25, 1] }) }];
      default:
        return [];
    }
  })();

  return (
    <Animated.View style={{ transform }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon size={size} color={color} strokeWidth={strokeWidth} />
    </Animated.View>
  );
}
