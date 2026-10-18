import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { useUi } from "../store";
import {
  activateHint,
  collectHintTargets,
  isEditing,
  isHintTrigger,
  keyboardScope,
  openKeyboardContextMenu,
  type HintTarget,
} from "../lib/keyboard";

/** Screen-local shortcuts for every visible control. No focus-stealing input:
 * labels also work over a text selection, nested modal or focused text field. */
export default function KeyboardHints() {
  const { t } = useTranslation();
  const [hints, setHints] = useState<HintTarget[]>([]);
  const [prefix, setPrefix] = useState("");
  const [active, setActive] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current: HintTarget[] | null = null;
    let typed = "";
    let scope: HTMLElement | null = null;
    let frame = 0;
    let observer: MutationObserver | null = null;
    const consume = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const close = () => {
      current = null;
      scope = null;
      typed = "";
      cancelAnimationFrame(frame);
      observer?.disconnect();
      setActive(false);
      setHints([]);
      setPrefix("");
      setInvalid(false);
      useUi.getState().setKeyboardHintsOpen(false);
    };
    const refresh = () => {
      if (!current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!current) return;
        if (keyboardScope() !== scope) {
          close();
          return;
        }
        current = collectHintTargets(scope!);
        typed = "";
        setHints(current);
        setPrefix("");
      });
    };
    const open = () => {
      current = [];
      typed = "";
      setPrefix("");
      setInvalid(false);
      setActive(true);
      useUi.getState().setKeyboardHintsOpen(true);
      // Suspending the native page view rerenders Reader. Capture targets only
      // after React has committed that change, not from the old article DOM.
      frame = requestAnimationFrame(() => {
        // A just-opened dialog may start its entrance animation at opacity 0.
        frame = requestAnimationFrame(() => {
          if (!current) return;
          scope = keyboardScope();
          current = collectHintTargets(scope);
          setHints(current);
          // Invalidate rather than relabel under the user's fingers if UI changes.
          observer = new MutationObserver((records) => {
            if (
              records.some((r) => {
                if (rootRef.current?.contains(r.target)) return false;
                const nodes = [...r.addedNodes, ...r.removedNodes];
                return (
                  r.type !== "childList" ||
                  nodes.some(
                    (node) => !(node instanceof Element && node.matches("[data-keyboard-hints]")),
                  )
                );
              })
            )
              close();
          });
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: [
              "disabled",
              "aria-disabled",
              "hidden",
              "inert",
              "id",
              "href",
              "src",
              "class",
              "style",
              "aria-label",
            ],
          });
        });
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) {
        if (current) close();
        return;
      }
      if (e.defaultPrevented) return;
      if (isHintTrigger(e)) {
        consume(e);
        if (current) close();
        else open();
        return;
      }
      if (current) {
        if (e.key === "Escape") {
          consume(e);
          close();
          return;
        }
        if (e.key === "Backspace") {
          consume(e);
          typed = typed.slice(0, -1);
          setPrefix(typed);
          setInvalid(false);
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) {
          close();
          return;
        }
        // Let Tab / arrow keys resume native navigation, not article shortcuts.
        if (
          [
            "Tab",
            "ArrowDown",
            "ArrowUp",
            "ArrowLeft",
            "ArrowRight",
            "PageDown",
            "PageUp",
            "Home",
            "End",
            " ",
          ].includes(e.key)
        ) {
          close();
          e.stopImmediatePropagation();
          return;
        }
        if (e.key.length !== 1) {
          if (e.key !== "Shift") consume(e);
          return;
        }
        consume(e);
        if (e.repeat) return;
        typed += e.key.toLowerCase();
        const matches = current.filter((h) => h.label.startsWith(typed));
        if (matches.length === 0) {
          typed = "";
          setPrefix("");
          setInvalid(true);
          return;
        }
        setPrefix(typed);
        setInvalid(false);
        const exact = matches.find((h) => h.label === typed);
        if (exact) {
          // Capture the node before closing; the native webview can reappear.
          const el = exact.element;
          const valid = keyboardScope() === scope;
          close();
          if (valid) activateHint(el);
        }
        return;
      }
      if ((e.key === "F10" && e.shiftKey) || e.key === "ContextMenu") {
        if (openKeyboardContextMenu()) consume(e);
        return;
      }
      if (
        e.key === "F6" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        keyboardScope() === document.body
      ) {
        const panes = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".sidebar-scroll, .list-scroll, .reader-scroll, .ai-drawer.open .ai-body",
          ),
        ).filter((el) => el.getClientRects().length && !el.closest("[inert]"));
        if (!panes.length) return;
        const i = panes.findIndex((el) => el.contains(document.activeElement));
        const next =
          i < 0
            ? e.shiftKey
              ? panes.length - 1
              : 0
            : (i + (e.shiftKey ? -1 : 1) + panes.length) % panes.length;
        consume(e);
        panes[next].focus();
        return;
      }
      // Escape leaves a form control before global reading shortcuts resume.
      if (e.key === "Escape" && isEditing(e.target) && keyboardScope() === document.body) {
        consume(e);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    const onPointer = () => {
      if (current) close();
    };
    const onBlur = () => {
      if (current) close();
    };
    const onScroll = (e: Event) => {
      // Scrolling a virtual list changes its DOM asynchronously; cancel rather
      // than let an old label act on the new article in the recycled slot.
      if (current && !rootRef.current?.contains(e.target as Node)) close();
    };
    const unlisten = listen("keyboard-hints-requested", () => {
      if (!current) open();
    });
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", refresh);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      unlisten.then((f) => f()).catch(() => {});
      observer?.disconnect();
      cancelAnimationFrame(frame);
      useUi.getState().setKeyboardHintsOpen(false);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", refresh);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  return active
    ? createPortal(
        <div className="keyboard-hints" data-keyboard-hints ref={rootRef}>
          {hints
            .filter((h) => h.label.startsWith(prefix))
            .map((h) => (
              <span
                key={h.label}
                className="keyboard-hint"
                style={{ left: h.left, top: h.top }}
                aria-hidden="true"
              >
                <span className="keyboard-hint-typed">{h.label.slice(0, prefix.length)}</span>
                {h.label.slice(prefix.length)}
              </span>
            ))}
          <div className="keyboard-hints-status" role="status" aria-live="polite">
            {invalid
              ? t("settings.shortcuts.hintsInvalid")
              : hints.length
                ? t("settings.shortcuts.hintsStatus", {
                    count: hints.filter((h) => h.label.startsWith(prefix)).length,
                  })
                : t("settings.shortcuts.hintsEmpty")}
          </div>
        </div>,
        document.body,
      )
    : null;
}
