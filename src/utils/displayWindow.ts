/**
 * Utility for managing the dedicated external display window.
 * Ensures that clicking "Open Display" reuses the existing window
 * named 'gh-raisoni-admission-display' rather than creating duplicates,
 * and sends a DISPLAY_REFRESH signal to ensure current state is rendered.
 */

let displayWindowRef: Window | null = null;

export const DISPLAY_WINDOW_NAME = 'gh-raisoni-admission-display';

export function openOrFocusDisplayWindow(): Window | null {
  const url = `${window.location.origin}/display`;
  const windowFeatures =
    'popup=yes,width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no';

  try {
    // If the reference exists and is not closed, bring it to focus
    if (displayWindowRef && !displayWindowRef.closed) {
      displayWindowRef.focus();
      try {
        displayWindowRef.postMessage({ type: 'DISPLAY_REFRESH' }, window.location.origin);
      } catch {
        // window messaging fallback
      }
      // Also broadcast refresh
      notifyDisplayRefresh();
      return displayWindowRef;
    }

    // Otherwise, open or re-attach to the window by name
    displayWindowRef = window.open(url, DISPLAY_WINDOW_NAME, windowFeatures);
    if (displayWindowRef) {
      displayWindowRef.focus();
      // Delayed postMessage to ensure the window has mounted its listener
      setTimeout(() => {
        try {
          if (displayWindowRef && !displayWindowRef.closed) {
            displayWindowRef.postMessage({ type: 'DISPLAY_REFRESH' }, window.location.origin);
          }
        } catch {
          // window messaging fallback
        }
      }, 400);
    }
  } catch (err) {
    console.error('Error opening display window:', err);
    displayWindowRef = window.open(url, DISPLAY_WINDOW_NAME);
  }

  notifyDisplayRefresh();
  return displayWindowRef;
}

export function notifyDisplayRefresh(): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('gh_raisoni_admission_channel');
      channel.postMessage({ type: 'DISPLAY_REFRESH', timestamp: Date.now() });
      channel.close();
    }
  } catch {
    // BroadcastChannel fallback
  }
}
