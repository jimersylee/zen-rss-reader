// Contain keyboard focus within a modal dialog while it is open, so Tab can't
// walk into the (visually obscured) background behind it.

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab / Shift+Tab inside `ref`'s subtree while active.
 *
 * `enabled` lets a component that stays mounted but toggles its modal on and
 * off (rather than mounting fresh each time) re-arm the trap: the effect
 * re-runs when it flips, by which point `ref` points at the now-rendered node.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = el.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [ref, enabled]);
}
