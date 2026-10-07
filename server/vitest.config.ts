import { defineConfig } from "vitest/config";

// Blank out MONGODB_URI for every test, so even if it is exported in the
// shell, no test can reach a real MongoDB. Tests that need Mongo mock the
// driver instead (see src/data/mongoSource.test.ts).
export default defineConfig({
  test: {
    // dist/ holds compiled copies of the tests (from `npm run build`); running
    // them too fails because tsc does not copy their JSON fixtures.
    exclude: ["dist/**", "node_modules/**"],
    env: { MONGODB_URI: "" },
  },
});
