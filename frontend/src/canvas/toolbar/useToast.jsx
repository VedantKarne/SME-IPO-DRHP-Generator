/**
 * useToast.js — Toast notification hook + container component.
 *
 * Exports:
 *   default  useToast       — hook that manages toast state
 *   named    ToastContainer — renders the toast stack (position fixed, bottom-right)
 *
 * Usage:
 *   const { toasts, showToast, dismissToast } = useToast();
 *   showToast('Saved!', 'success', 3000);
 *   showToast('Backend unavailable', 'warning');
 *   showToast('Export failed', 'error');
 *
 * Phase 2 polish:
 *   — Uses CSS class-based animation (toastSlideIn / toastSlideOut) defined in
 *     canvas.css instead of inline keyframes.
 *   — Supports 'info' type for neutral messages.
 *   — Icon per type for instant visual scanning.
 *   — Exit animation: class toggled just before item is removed from state.
 */

import { useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// useToast hook
// ---------------------------------------------------------------------------

function useToast() {
  const [toasts, setToasts] = useState([]);
  // Tracks exit-animation timeouts so they can be cancelled on manual dismiss
  const exitTimers = useRef({});

  /**
   * Begin the exit animation, then remove the toast after it completes.
   * Duration matches the CSS toastSlideOut animation (180ms).
   */
  const dismissToast = useCallback((id) => {
    // Mark as exiting (triggers exit animation via CSS class)
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    exitTimers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete exitTimers.current[id];
    }, 200); // matches toastSlideOut duration
  }, []);

  /**
   * Add a new toast.
   * @param {string} message
   * @param {'success'|'warning'|'error'|'info'} type
   * @param {number} duration  ms before auto-dismiss (default 3000)
   */
  const showToast = useCallback(
    (message, type = 'success', duration = 3000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type, duration, exiting: false }]);
      // Auto-dismiss after duration
      const autoTimer = setTimeout(() => dismissToast(id), duration);
      exitTimers.current[`auto-${id}`] = autoTimer;
    },
    [dismissToast]
  );

  return { toasts, showToast, dismissToast };
}

// ---------------------------------------------------------------------------
// Icon per type
// ---------------------------------------------------------------------------

const TYPE_ICONS = {
  success: '✓',
  warning: '⚠',
  error:   '✕',
  info:    '↗',
};

// ---------------------------------------------------------------------------
// ToastContainer component
// ---------------------------------------------------------------------------

/**
 * Renders the current toast stack at bottom-right of the viewport.
 * Uses CSS classes from canvas.css for all styling and animations.
 *
 * @param {{ toasts: Array, dismissToast: (id: string) => void }} props
 */
function ToastContainer({ toasts, dismissToast }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item toast-item--${toast.type}${toast.exiting ? ' toast-item--exiting' : ''}`}
          role="alert"
          aria-atomic="true"
        >
          <span className="toast-item__icon" aria-hidden="true">
            {TYPE_ICONS[toast.type] ?? TYPE_ICONS.info}
          </span>
          <span className="toast-item__msg">{toast.message}</span>
          <button
            type="button"
            className="toast-item__close"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default useToast;
export { ToastContainer };
