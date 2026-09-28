/**
 * PRYORA Dynamic Lucide Icon Resolver
 */

import React from 'react';
import {
  Wallet,
  CreditCard,
  Building2,
  Coins,
  TrendingUp,
  Landmark,
  PiggyBank,
  Utensils,
  Car,
  Home,
  Tv,
  Zap,
  ShoppingBag,
  HeartPulse,
  BookOpen,
  Plane,
  Shield,
  HelpCircle,
  Tag,
  Target,
  ArrowRightLeft,
  DollarSign,
  Coffee,
  Smartphone,
  Wifi,
  Briefcase,
  LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Wallet,
  CreditCard,
  Building2,
  Coins,
  TrendingUp,
  Landmark,
  PiggyBank,
  Utensils,
  Car,
  Home,
  Tv,
  Zap,
  ShoppingBag,
  HeartPulse,
  BookOpen,
  Plane,
  Shield,
  HelpCircle,
  Tag,
  Target,
  ArrowRightLeft,
  DollarSign,
  Coffee,
  Smartphone,
  Wifi,
  Briefcase,
};

interface IconProps extends LucideProps {
  name?: string;
}

export const CategoryIcon: React.FC<IconProps> = ({ name, ...props }) => {
  if (!name) return <Tag {...props} />;
  const Comp = ICON_MAP[name] || Tag;
  return <Comp {...props} />;
};

export const AccountIcon: React.FC<IconProps> = ({ name, ...props }) => {
  if (!name) return <Wallet {...props} />;
  const Comp = ICON_MAP[name] || Wallet;
  return <Comp {...props} />;
};
