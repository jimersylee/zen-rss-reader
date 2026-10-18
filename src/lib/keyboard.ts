// Shared keyboard rules. Hints use the existing click handlers, not a second
// implementation of each action, so confirmations and Undo remain in force.
export const HINT_ALPHABET = "asdfghjklqwertyuiopzxcvbnm";

/** Equal-width labels are prefix-free, including when there are >26 targets. */
export function hintLabels(count: number): string[] {
  if (count <= 0) return [];
  const base = HINT_ALPHABET.length;
  let width = 1;
  while (base ** width < count) width++;
  return Array.from({ length: count }, (_, i) => {
    let label = "";
    for (let j = 0; j < width; j++) {
      label = HINT_ALPHABET[i % base] + label;
      i = Math.floor(i / base);
    }
    return label;
  });
}

export function isEditing(target: EventTarget | null): boolean {
  return (
    target != null &&
    target instanceof Element &&
    !!target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
        '[role="textbox"], [role="combobox"], [role="spinbutton"]',
    )
  );
}

export function isHintTrigger(e: KeyboardEvent): boolean {
  if (e.isComposing || e.keyCode === 229 || e.altKey || e.repeat) return false;
  const semicolon = e.code === "Semicolon" || e.key === ";";
  if (!semicolon) return false;
  if (e.metaKey || e.ctrlKey) return e.shiftKey;
  return !e.shiftKey && !isEditing(e.target);
}

export interface VisibleRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Intersect with scrollports as well as the viewport: offscreen controls in
 * settings and virtual lists must not get labels over unrelated controls. */
export function visibleRect(el: HTMLElement): VisibleRect | null {
  if (
    !el.isConnected ||
    el.closest('[inert], [hidden], [aria-hidden="true"]') ||
    el.matches(':disabled, [aria-disabled="true"]')
  )
    return null;
  if (el.getClientRects().length === 0) return null;
  const style = getComputedStyle(el);
  if (style.visibility !== "visible") return null;
  const r = el.getBoundingClientRect();
  let left = Math.max(0, r.left),
    top = Math.max(0, r.top);
  let right = Math.min(innerWidth, r.right),
    bottom = Math.min(innerHeight, r.bottom);
  for (let p: HTMLElement | null = el; p; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (Number(s.opacity) === 0) return null;
    if (p === el) continue;
    const b = p.getBoundingClientRect();
    if (/auto|scroll|hidden|clip/.test(s.overflowX)) {
      left = Math.max(left, b.left);
      right = Math.min(right, b.right);
    }
    if (/auto|scroll|hidden|clip/.test(s.overflowY)) {
      top = Math.max(top, b.top);
      bottom = Math.min(bottom, b.bottom);
    }
  }
  return right - left >= 2 && bottom - top >= 2 ? { left, top, right, bottom } : null;
}

/** The frontmost dialog/menu owns the keyboard, including nested confirms. */
export function keyboardScope(): HTMLElement {
  const layers = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [role="alertdialog"], [role="menu"], .cp, .tag-picker, .hl-toolbar',
    ),
  ).filter(
    (el) =>
      el.getClientRects().length > 0 &&
      !el.closest('[inert], [hidden], [aria-hidden="true"]') &&
      getComputedStyle(el).visibility === "visible",
  );
  const z = (el: HTMLElement) => {
    let value = 0;
    for (let p: HTMLElement | null = el; p; p = p.parentElement) {
      value = Math.max(value, Number.parseInt(getComputedStyle(p).zIndex) || 0);
    }
    return value;
  };
  // Stable sorting preserves document order for equally elevated nested modals.
  return layers.sort((a, b) => z(a) - z(b)).at(-1) ?? document.body;
}

const TARGETS = [
  "button",
  "a[href]",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "summary",
  "video[controls]",
  "audio[controls]",
  "iframe",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="separator"][tabindex]',
  "[data-keyboard-scroll]",
  ".article-body mark[data-hl]",
  ".article-body img",
].join(",");

export interface HintTarget {
  element: HTMLElement;
  label: string;
  left: number;
  top: number;
}

export function collectHintTargets(scope = keyboardScope()): HintTarget[] {
  const targets: Omit<HintTarget, "label">[] = [];
  for (const element of scope.querySelectorAll<HTMLElement>(TARGETS)) {
    if (element.closest("[data-keyboard-hints]")) continue;
    const r = visibleRect(element);
    if (!r) continue;
    // Ignore covered controls, including ones hidden behind sticky toolbars.
    // Probe more than the centre so a child button doesn't hide a folder row.
    const points = [
      [(r.left + r.right) / 2, (r.top + r.bottom) / 2],
      [r.left + 1, r.top + 1],
    ];
    if (
      !points.some(([x, y]) => {
        const top = document.elementFromPoint(x, y);
        return !!top && (element === top || element.contains(top));
      })
    )
      continue;
    // Put nested folder chevrons / links at separate labels if they share a corner.
    let left = r.left + 2,
      top = r.top + 2;
    while (targets.some((t) => Math.abs(t.left - left) < 28 && Math.abs(t.top - top) < 18)) {
      left += 28;
      if (left > innerWidth - 45) {
        left = r.left + 2;
        top += 18;
      }
    }
    targets.push({
      element,
      left: Math.min(left, innerWidth - 45),
      top: Math.min(top, innerHeight - 22),
    });
  }
  const labels = hintLabels(targets.length);
  return targets.map((target, i) => ({ ...target, label: labels[i] }));
}

/** Returns false for stale/disabled targets; never click a replacement node at
 * the same coordinates after an async refresh or dialog transition. */
export function activateHint(el: HTMLElement): boolean {
  if (!visibleRect(el)) return false;
  const focusOnly = el.matches(
    'select, textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), ' +
      '[role="separator"], [data-keyboard-scroll], img, video, audio, iframe',
  );
  // Toolbar clicks must preserve the live text selection used for highlights.
  if (!el.closest(".hl-toolbar")) {
    if (el.tabIndex < 0 && !el.hasAttribute("tabindex")) el.tabIndex = -1;
    el.focus({ preventScroll: true });
  }
  if (!focusOnly) el.click();
  return true;
}

export function openKeyboardContextMenu(): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active || isEditing(active)) return false;
  // A listbox keeps DOM focus on itself; its selected option is the action target.
  const id = active.getAttribute("aria-activedescendant");
  const target = (id ? document.getElementById(id) : active) ?? active;
  if (!target.closest("[data-keyboard-context]")) return false;
  const r = visibleRect(target);
  if (!r) return false;
  target.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: r.left + 8,
      clientY: r.top + 8,
    }),
  );
  return true;
}
