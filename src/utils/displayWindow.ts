/**
 * Utility for managing the dedicated external display window.
 * Ensures that clicking "Open Display" reuses the existing window
 * named 'gh-raisoni-admission-display' rather than creating duplicates,
 * and sends a DISPLAY_REFRESH signal to ensure current state is rendered live.
 */

let displayWindowRef: Window | null = null;

export const DISPLAY_WINDOW_NAME = 'gh-raisoni-admission-display';

export function openOrFocusDisplayWindow(): Window | null {
  const origin = window.location.origin;
  const url = `${origin}/display?standalone=true`;
  const windowFeatures =
    'popup=yes,width=1440,height=900,menubar=no,toolbar=no,location=no,status=no,resizable=yes';

  try {
    // If the reference exists and is not closed, bring it to focus
    if (displayWindowRef && !displayWindowRef.closed) {
      displayWindowRef.focus();
      try {
        displayWindowRef.postMessage({ type: 'DISPLAY_REFRESH', timestamp: Date.now() }, '*');
      } catch {
        // window messaging fallback
      }
      notifyDisplayRefresh();
      return displayWindowRef;
    }

    // Attempt to open named popup window
    displayWindowRef = window.open(url, DISPLAY_WINDOW_NAME, windowFeatures);

    // Fallback 1: If popup blocker or sandbox restricted windowFeatures, try standard blank window
    if (!displayWindowRef) {
      try {
        displayWindowRef = window.open(url, '_blank');
      } catch {
        displayWindowRef = null;
      }
    }

    // Fallback 2: Programmatic anchor click (works in strict iframe sandboxes)
    if (!displayWindowRef) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      displayWindowRef.focus();
      // Send sequential postMessages as the new window boots up
      [300, 800, 1500].forEach((delay) => {
        setTimeout(() => {
          try {
            if (displayWindowRef && !displayWindowRef.closed) {
              displayWindowRef.postMessage({ type: 'DISPLAY_REFRESH', timestamp: Date.now() }, '*');
            }
          } catch {
            // fallback
          }
        }, delay);
      });
    }
  } catch (err) {
    console.error('Error opening display window:', err);
    try {
      displayWindowRef = window.open(url, '_blank');
    } catch {
      // fallback
    }
  }

  notifyDisplayRefresh();
  return displayWindowRef;
}

export function notifyDisplayRefresh(): void {
  const now = Date.now();

  // 1. BroadcastChannel across all tabs and windows on origin
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('gh_raisoni_admission_channel');
      channel.postMessage({ type: 'DISPLAY_REFRESH', timestamp: now });
      channel.close();
    }
  } catch {
    // BroadcastChannel fallback
  }

  // 2. localStorage storage event (instant cross-window trigger in all browsers)
  try {
    localStorage.setItem('gh_raisoni_admission_last_sync', String(now));
  } catch {
    // localStorage fallback
  }

  // 3. Custom DOM events for same-window components
  try {
    window.dispatchEvent(
      new CustomEvent('admission_data_updated', { detail: { timestamp: now } })
    );
    window.dispatchEvent(
      new CustomEvent('admission_capacities_updated', { detail: { timestamp: now } })
    );
  } catch {
    // CustomEvent fallback
  }

  // 4. Direct postMessage to opened window if active
  try {
    if (displayWindowRef && !displayWindowRef.closed) {
      displayWindowRef.postMessage({ type: 'DISPLAY_REFRESH', timestamp: now }, '*');
    }
  } catch {
    // postMessage fallback
  }
}
