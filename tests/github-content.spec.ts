import { describe, expect, it } from "vite-plus/test";

import {
  createStorageChangeHandler,
  getRepositoryFromLocation,
} from "../entrypoints/github.content";

describe("github content helpers", () => {
  it("extracts owner and repo from GitHub PR URLs", () => {
    expect(getRepositoryFromLocation(new URL("https://github.com/luvpame/demo/pull/1"))).toEqual({
      owner: "luvpame",
      repo: "demo",
    });
  });

  it("ignores non-PR URLs", () => {
    expect(getRepositoryFromLocation(new URL("https://github.com/luvpame/demo"))).toBeNull();
  });

  it("creates a storage change handler that refreshes features", () => {
    let calls = 0;
    const handler = createStorageChangeHandler(() => {
      calls += 1;
    });

    handler();

    expect(calls).toBe(1);
  });
});
