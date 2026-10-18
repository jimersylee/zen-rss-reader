// Contain Tab navigation within the topmost dialog, and restore its trigger.
import { useEffect, useRef, type RefObject } from "react";
import { keyboardScope } from "../lib/keyboard";

const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), " +
  "select:not([disabled]), textarea:not([disabled]), " +
  '[tabindex]:not([tabindex="-1"])';

function isVisible(el: HTMLElement): boolean {
  return (
    el.getClientRects().length > 0 &&
    !el.closest('[inert], [hidden], [aria-hidden="true"]') &&
    !el.matches(':disabled, [aria-disabled="true"]') &&
    getComputedStyle(el).visibility === "visible"
  );
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, enabled = true) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasEnabled = useRef(false);
  // Capture during the opening render, before a child's autoFocus takes over.
  if (enabled && !wasEnabled.current) triggerRef.current = document.activeElement as HTMLElement;
  wasEnabled.current = enabled;
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const trigger = triggerRef.current;
    const items = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
    // Respect existing autoFocus (rename input / safe Cancel button). Otherwise
    // Settings used to open with focus still on the obscured main screen.
    if (!el.contains(document.activeElement)) items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented) return;
      const scope = keyboardScope();
      if (scope !== el && !scope.contains(el)) return;
      const controls = items();
      if (!controls.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      const outside = !el.contains(document.activeElement);
      if (e.shiftKey && (outside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    // Capture on document also recovers focus accidentally left outside a modal.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (el.contains(document.activeElement) || document.activeElement === document.body) {
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      }
    };
  }, [ref, enabled]);
}
