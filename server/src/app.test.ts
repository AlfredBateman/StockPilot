import { describe, it, expect } from "vitest";
import { createApp } from "./app.js";

describe("createApp", () => {
  it("builds an Express app", () => {
    const app = createApp();
    expect(typeof app.listen).toBe("function");
  });
});
