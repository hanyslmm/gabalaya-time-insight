import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointsBadgeProps {
  points: number;
  level?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const getPointsTier = (points: number): 'gold' | 'silver' | 'bronze' | 'default' => {
  if (points >= 100) return 'gold';
  if (points >= 50) return 'silver';
  if (points >= 25) return 'bronze';
  return 'default';
};

const getTierConfig = (tier: 'gold' | 'silver' | 'bronze' | 'default') => {
  switch (tier) {
    case 'gold':
      return {
        bg: 'bg-gradient-to-r from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700',
        text: 'text-yellow-50',
        border: 'border-yellow-400',
        icon: Trophy,
        glow: 'shadow-lg shadow-yellow-500/50'
      };
    case 'silver':
      return {
        bg: 'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-600',
        text: 'text-gray-50',
        border: 'border-gray-300',
        icon: Medal,
        glow: 'shadow-md shadow-gray-400/50'
      };
    case 'bronze':
      return {
        bg: 'bg-gradient-to-r from-orange-400 to-orange-500 dark:from-orange-600 dark:to-orange-700',
        text: 'text-orange-50',
        border: 'border-orange-400',
        icon: Award,
        glow: 'shadow-md shadow-orange-400/50'
      };
    default:
      return {
        bg: 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
        text: 'text-blue-50',
        border: 'border-blue-400',
        icon: Star,
        glow: 'shadow-sm shadow-blue-400/30'
      };
  }
};

const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return {
        badge: 'text-xs px-2 py-0.5',
        icon: 'h-3 w-3'
      };
    case 'lg':
      return {
        badge: 'text-base px-4 py-2',
        icon: 'h-5 w-5'
      };
    default:
      return {
        badge: 'text-sm px-3 py-1',
        icon: 'h-4 w-4'
      };
  }
};

export const PointsBadge: React.FC<PointsBadgeProps> = ({
  points,
  level,
  size = 'md',
  showIcon = true,
  className
}) => {
  const tier = getPointsTier(points);
  const config = getTierConfig(tier);
  const sizeClasses = getSizeClasses(size);
  const Icon = config.icon;

  return (
    <Badge
      className={cn(
        config.bg,
        config.text,
        config.border,
        config.glow,
        sizeClasses.badge,
        'border-2 font-bold flex items-center gap-1.5',
        className
      )}
    >
      {showIcon && <Icon className={sizeClasses.icon} />}
      <span>{points}</span>
      {level && <span className="opacity-90">• {level}</span>}
    </Badge>
  );
};

