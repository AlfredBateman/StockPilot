import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWatchlist, saveWatchlist } from "./useWatchlist";

function makeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
}

describe("loadWatchlist", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns [] when nothing is stored", () => {
    vi.stubGlobal("localStorage", makeStorage());
    expect(loadWatchlist()).toEqual([]);
  });

  it("returns the saved ticker list", () => {
    vi.stubGlobal("localStorage", makeStorage({ "stockpilot:watchlist": JSON.stringify(["TCS.NS", "INFY.NS"]) }));
    expect(loadWatchlist()).toEqual(["TCS.NS", "INFY.NS"]);
  });

  it("ignores corrupt JSON instead of throwing", () => {
    vi.stubGlobal("localStorage", makeStorage({ "stockpilot:watchlist": "{not json" }));
    expect(loadWatchlist()).toEqual([]);
  });

  it("ignores a non-array value", () => {
    vi.stubGlobal("localStorage", makeStorage({ "stockpilot:watchlist": JSON.stringify({ a: 1 }) }));
    expect(loadWatchlist()).toEqual([]);
  });

  it("drops non-string entries", () => {
    vi.stubGlobal("localStorage", makeStorage({ "stockpilot:watchlist": JSON.stringify(["TCS.NS", 5, null]) }));
    expect(loadWatchlist()).toEqual(["TCS.NS"]);
  });

  it("returns [] when localStorage access throws (storage disabled)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadWatchlist()).toEqual([]);
  });
});

describe("saveWatchlist", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes the ticker list as JSON", () => {
    const storage = makeStorage();
    vi.stubGlobal("localStorage", storage);
    saveWatchlist(["TCS.NS"]);
    expect(storage.getItem("stockpilot:watchlist")).toBe(JSON.stringify(["TCS.NS"]));
  });

  it("does not throw when localStorage.setItem throws (quota/disabled)", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });
    expect(() => saveWatchlist(["TCS.NS"])).not.toThrow();
  });
});
