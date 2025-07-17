import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate } from '@/utils/pwa';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
  threshold?: number;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  threshold = 80
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const touch = e.touches[0];
    const scrollTop = containerRef.current?.scrollTop || 0;
    
    // Only start pull-to-refresh if we're at the top
    if (scrollTop === 0) {
      setTouchStart(touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || isRefreshing || touchStart === null) return;
    
    const touch = e.touches[0];
    const distance = touch.clientY - touchStart;
    
    if (distance > 0) {
      // Prevent default scrolling when pulling down
      e.preventDefault();
      
      // Apply resistance to the pull
      const resistance = 0.5;
      const adjustedDistance = distance * resistance;
      
      setPullDistance(Math.min(adjustedDistance, threshold * 1.5));
      setCanRefresh(adjustedDistance >= threshold);
      
      // Haptic feedback when reaching threshold
      if (adjustedDistance >= threshold && !canRefresh) {
        vibrate(50);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (disabled || isRefreshing || touchStart === null) return;
    
    setTouchStart(null);
    
    if (canRefresh) {
      setIsRefreshing(true);
      vibrate(100);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setCanRefresh(false);
      }
    }
    
    setPullDistance(0);
  };

  // Reset state when refreshing completes
  useEffect(() => {
    if (!isRefreshing) {
      setPullDistance(0);
      setCanRefresh(false);
    }
  }, [isRefreshing]);

  const refreshIndicatorOpacity = Math.min(pullDistance / threshold, 1);
  const refreshIndicatorScale = Math.min(pullDistance / threshold, 1);
  const refreshIndicatorRotation = (pullDistance / threshold) * 360;

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s ease-out' : 'none'
      }}
    >
      {/* Refresh indicator */}
      <div
        className={cn(
          "absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full",
          "flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full",
          "backdrop-blur-sm transition-all duration-300"
        )}
        style={{
          opacity: refreshIndicatorOpacity,
          transform: `translateX(-50%) translateY(-100%) scale(${refreshIndicatorScale})`,
          top: `-${threshold / 2}px`
        }}
      >
        <RefreshCw
          className={cn(
            "w-6 h-6 text-primary transition-transform duration-300",
            isRefreshing && "animate-spin"
          )}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${refreshIndicatorRotation}deg)`
          }}
        />
      </div>

      {/* Status text */}
      {pullDistance > 0 && (
        <div
          className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full text-sm text-muted-foreground text-center"
          style={{
            opacity: refreshIndicatorOpacity,
            top: `-${threshold / 4}px`
          }}
        >
          {isRefreshing ? 'Refreshing...' : canRefresh ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      {/* Content */}
      <div className="min-h-full">
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;