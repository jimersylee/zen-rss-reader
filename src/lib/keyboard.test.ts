import { describe, expect, it } from "vitest";
import { HINT_ALPHABET, hintLabels, isHintTrigger } from "./keyboard";

describe("hintLabels", () => {
  it("handles empty screens", () => expect(hintLabels(0)).toEqual([]));
  it("uses home-row letters for small screens", () => {
    expect(hintLabels(3)).toEqual(["a", "s", "d"]);
  });
  it.each([26, 27, 120, 676, 677, 1000])("is unique and prefix-free for %i controls", (count) => {
    const labels = hintLabels(count);
    expect(labels).toHaveLength(count);
    expect(new Set(labels).size).toBe(count);
    expect(new Set(labels.map((l) => l.length)).size).toBe(1);
    expect(labels.every((l) => [...l].every((c) => HINT_ALPHABET.includes(c)))).toBe(true);
  });
  it("assigns labels deterministically", () => expect(hintLabels(90)).toEqual(hintLabels(90)));
});

const key = (patch: Partial<KeyboardEvent> = {}) =>
  ({
    key: ";",
    code: "Semicolon",
    target: null,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    keyCode: 0,
    ...patch,
  }) as KeyboardEvent;

describe("hint shortcut recognition", () => {
  it("opens with a bare semicolon outside fields", () => expect(isHintTrigger(key())).toBe(true));
  it("recognises the physical key under a CJK punctuation layout", () => {
    expect(isHintTrigger(key({ key: "；" }))).toBe(true);
  });
  it.each(["ctrlKey", "metaKey"] as const)("supports the %s + Shift alternative", (modifier) => {
    expect(isHintTrigger(key({ key: ":", shiftKey: true, [modifier]: true }))).toBe(true);
    expect(isHintTrigger(key({ [modifier]: true }))).toBe(false);
  });
  it.each([
    { isComposing: true },
    { keyCode: 229 },
    { altKey: true },
    { repeat: true },
    { shiftKey: true },
    { code: "KeyA", key: "a" },
  ])("does not intercept composition, repeat or unrelated keys: %j", (patch) => {
    expect(isHintTrigger(key(patch))).toBe(false);
  });
});
