/**
 * Enhanced click handler utility to prevent double-click issues on desktop
 * Provides debouncing and proper event handling for better UX
 */

interface ClickHandlerOptions {
  /** Debounce delay in milliseconds (default: 150ms) */
  debounceMs?: number;
  /** Whether to prevent default behavior */
  preventDefault?: boolean;
  /** Whether to stop event propagation */
  stopPropagation?: boolean;
  /** Callback function to execute */
  callback: (event: React.MouseEvent | MouseEvent) => void;
}

/**
 * Creates a debounced click handler that prevents double-clicks
 * and handles event propagation properly
 */
export function createClickHandler(options: ClickHandlerOptions) {
  const {
    debounceMs = 150,
    preventDefault = false,
    stopPropagation = false,
    callback
  } = options;

  let lastClickTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return (event: React.MouseEvent | MouseEvent) => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;

    // Clear any pending timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Prevent rapid double-clicks (within debounce window)
    if (timeSinceLastClick < debounceMs) {
      return;
    }

    // Handle event modifiers
    if (preventDefault) {
      event.preventDefault();
    }
    if (stopPropagation) {
      event.stopPropagation();
    }

    // Update last click time
    lastClickTime = now;

    // Execute callback with debounce
    timeoutId = setTimeout(() => {
      callback(event);
      timeoutId = null;
    }, 10); // Small delay to ensure single execution
  };
}

/**
 * Wrapper for onClick handlers that prevents double-clicks
 * Use this for buttons and interactive elements
 */
export function handleSingleClick(
  callback: (event: React.MouseEvent) => void,
  options?: { debounceMs?: number; preventDefault?: boolean; stopPropagation?: boolean }
): (event: React.MouseEvent) => void {
  return createClickHandler({
    callback,
    debounceMs: options?.debounceMs ?? 150,
    preventDefault: options?.preventDefault ?? false,
    stopPropagation: options?.stopPropagation ?? false
  });
}

/**
 * Detects if the device is a touch device
 */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Detects if the current viewport is desktop-sized
 */
export function isDesktopViewport(): boolean {
  return window.matchMedia('(min-width: 1024px)').matches;
}

