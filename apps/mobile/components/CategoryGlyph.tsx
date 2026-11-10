import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import {
  ArrowLeftRight,
  Baby,
  BriefcaseBusiness,
  BusFront,
  Coins,
  Gamepad2,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Laptop,
  PawPrint,
  Plane,
  Receipt,
  Shapes,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';

import { fonts } from '@/constants/theme';
import type { TransactionType } from '@/constants/categories';
import {
  categoryIconName,
  categoryLetter,
  type CategoryIconName,
} from '@/lib/categoryIcons';

const ICONS: Record<CategoryIconName, LucideIcon> = {
  'shopping-basket': ShoppingBasket,
  users: Users,
  'paw-print': PawPrint,
  'bus-front': BusFront,
  house: House,
  shirt: Shirt,
  sparkles: Sparkles,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  gift: Gift,
  shapes: Shapes,
  baby: Baby,
  'gamepad-2': Gamepad2,
  receipt: Receipt,
  utensils: Utensils,
  plane: Plane,
  'hand-heart': HandHeart,
  'briefcase-business': BriefcaseBusiness,
  laptop: Laptop,
  coins: Coins,
  'arrow-left-right': ArrowLeftRight,
};

type Props = {
  category: string;
  type: TransactionType;
  color: string;
  iconSize: number;
  letterFontSize: number;
  /** Partner rows and any caller that must stay a letter. */
  letterOnly?: boolean;
  letterStyle?: StyleProp<TextStyle>;
};

/**
 * Built-in categories draw their Lucide glyph. Anything else is the
 * first letter of the name (custom categories, partner initial).
 */
export function CategoryGlyph({
  category,
  type,
  color,
  iconSize,
  letterFontSize,
  letterOnly = false,
  letterStyle,
}: Props) {
  const iconName = letterOnly ? null : categoryIconName(type, category);
  const Icon = iconName ? ICONS[iconName] : null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={Icon ? { width: iconSize, height: iconSize } : undefined}
    >
      {Icon ? (
        <Icon color={color} size={iconSize} strokeWidth={2} />
      ) : (
        <Text
          style={[
            styles.letter,
            { color, fontSize: letterFontSize },
            letterStyle,
          ]}
        >
          {categoryLetter(category)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  letter: {
    fontFamily: fonts.bodyStrong,
    textAlign: 'center',
  },
});
