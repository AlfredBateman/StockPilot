import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHintDismissed, saveHintDismissed } from "./useGuideHint";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guide hint storage", () => {
  it("shows the hint (not dismissed) on a first visit", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    expect(loadHintDismissed()).toBe(false);
  });

  it("remembers a dismissal", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    saveHintDismissed();
    expect(loadHintDismissed()).toBe(true);
  });

  it("treats an unexpected stored value as not dismissed", () => {
    vi.stubGlobal("localStorage", fakeStorage({ "stockpilot:guide-hint-dismissed": "maybe" }));
    expect(loadHintDismissed()).toBe(false);
  });

  it("never throws when storage is blocked: the hint just shows again", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("localStorage", blocked);
    expect(loadHintDismissed()).toBe(false);
    expect(() => saveHintDismissed()).not.toThrow();
  });
});
