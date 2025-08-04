// Mobile optimization utilities
import React from 'react';

export const isMobileDevice = (): boolean => {
  return window.innerWidth < 768;
};

export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export const getViewportHeight = (): number => {
  return window.innerHeight;
};

export const getViewportWidth = (): number => {
  return window.innerWidth;
};

export const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
    right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
    left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0'),
  };
};

export const getMobileClasses = (baseClasses: string): string => {
  if (!isMobileDevice()) return baseClasses;
  
  const mobileOptimizations = {
    'p-4': 'p-2 sm:p-4',
    'p-6': 'p-3 sm:p-6',
    'p-8': 'p-4 sm:p-8',
    'px-4': 'px-2 sm:px-4',
    'px-6': 'px-3 sm:px-6',
    'px-8': 'px-4 sm:px-8',
    'py-4': 'py-2 sm:py-4',
    'py-6': 'py-3 sm:py-6',
    'py-8': 'py-4 sm:py-8',
    'gap-4': 'gap-2 sm:gap-4',
    'gap-6': 'gap-3 sm:gap-6',
    'gap-8': 'gap-4 sm:gap-8',
    'space-y-4': 'space-y-2 sm:space-y-4',
    'space-y-6': 'space-y-3 sm:space-y-6',
    'space-y-8': 'space-y-4 sm:space-y-8',
    'space-x-4': 'space-x-2 sm:space-x-4',
    'space-x-6': 'space-x-3 sm:space-x-6',
    'space-x-8': 'space-x-4 sm:space-x-8',
    'mb-4': 'mb-2 sm:mb-4',
    'mb-6': 'mb-3 sm:mb-6',
    'mb-8': 'mb-4 sm:mb-8',
    'mt-4': 'mt-2 sm:mt-4',
    'mt-6': 'mt-3 sm:mt-6',
    'mt-8': 'mt-4 sm:mt-8',
    'text-3xl': 'text-xl sm:text-3xl',
    'text-2xl': 'text-lg sm:text-2xl',
    'text-xl': 'text-lg sm:text-xl',
    'text-lg': 'text-base sm:text-lg',
    'rounded-xl': 'rounded-lg sm:rounded-xl',
    'rounded-2xl': 'rounded-xl sm:rounded-2xl',
    'rounded-3xl': 'rounded-2xl sm:rounded-3xl',
  };
  
  let optimizedClasses = baseClasses;
  
  Object.entries(mobileOptimizations).forEach(([original, optimized]) => {
    optimizedClasses = optimizedClasses.replace(
      new RegExp(`\\b${original}\\b`, 'g'),
      optimized
    );
  });
  
  return optimizedClasses;
};

export const getResponsiveGridCols = (cols: number): string => {
  if (cols <= 2) return `grid-cols-${cols}`;
  if (cols <= 4) return `grid-cols-2 sm:grid-cols-${cols}`;
  return `grid-cols-2 sm:grid-cols-3 lg:grid-cols-${cols}`;
};

export const getResponsiveCardPadding = (size: 'sm' | 'md' | 'lg' = 'md'): string => {
  const sizes = {
    sm: 'p-2 sm:p-3',
    md: 'p-3 sm:p-4 lg:p-6',
    lg: 'p-4 sm:p-6 lg:p-8'
  };
  return sizes[size];
};

export const getResponsiveTextSize = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl'): string => {
  const sizes = {
    xs: 'text-xs',
    sm: 'text-xs sm:text-sm',
    base: 'text-sm sm:text-base',
    lg: 'text-base sm:text-lg',
    xl: 'text-lg sm:text-xl',
    '2xl': 'text-xl sm:text-2xl',
    '3xl': 'text-xl sm:text-2xl lg:text-3xl'
  };
  return sizes[size];
};

export const getResponsiveSpacing = (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): string => {
  const sizes = {
    xs: 'space-y-1 sm:space-y-2',
    sm: 'space-y-2 sm:space-y-3',
    md: 'space-y-3 sm:space-y-4',
    lg: 'space-y-4 sm:space-y-6',
    xl: 'space-y-6 sm:space-y-8'
  };
  return sizes[size];
};

export const getResponsiveIconSize = (size: 'sm' | 'md' | 'lg'): string => {
  const sizes = {
    sm: 'h-3 w-3 sm:h-4 sm:w-4',
    md: 'h-4 w-4 sm:h-5 sm:w-5',
    lg: 'h-5 w-5 sm:h-6 sm:w-6'
  };
  return sizes[size];
};

export const optimizeForMobile = (element: HTMLElement): void => {
  if (!isMobileDevice()) return;
  
  // Add mobile-specific classes
  element.classList.add('mobile-optimized');
  
  // Optimize touch targets
  const buttons = element.querySelectorAll('button, a, [role="button"]');
  buttons.forEach(button => {
    if (button instanceof HTMLElement) {
      button.classList.add('touch-target');
    }
  });
  
  // Optimize form inputs
  const inputs = element.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    if (input instanceof HTMLElement) {
      input.classList.add('mobile-form-input');
    }
  });
  
  // Optimize cards
  const cards = element.querySelectorAll('[class*="card"]');
  cards.forEach(card => {
    if (card instanceof HTMLElement) {
      card.classList.add('mobile-card');
    }
  });
};

export const setupMobileViewport = (): void => {
  // Set up proper viewport for mobile
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
  
  // Add CSS custom properties for safe areas
  if (CSS.supports('padding: env(safe-area-inset-top)')) {
    document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right)');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
    document.documentElement.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left)');
  }
  
  // Prevent zoom on double tap
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  // Handle orientation changes
  window.addEventListener('orientationchange', () => {
    // Force a reflow to handle orientation changes properly
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);
  });
};

// React hook for mobile optimization
export const useMobileOptimization = () => {
  const [isMobile, setIsMobile] = React.useState(isMobileDevice());
  const [isTouch, setIsTouch] = React.useState(isTouchDevice());
  
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  React.useEffect(() => {
    setupMobileViewport();
  }, []);
  
  return {
    isMobile,
    isTouch,
    getMobileClasses,
    getResponsiveGridCols,
    getResponsiveCardPadding,
    getResponsiveTextSize,
    getResponsiveSpacing,
    getResponsiveIconSize,
    optimizeForMobile
  };
};