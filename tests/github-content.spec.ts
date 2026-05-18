import { describe, expect, it } from "vite-plus/test";

import {
  createStorageChangeHandler,
  getHeadRef,
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

  it("extracts the pull request head ref from GitHub sha2 URLs", () => {
    document.body.innerHTML = `
      <include-fragment src="/luvpame/demo/diffs?sha2=12322913653a4b271361ebac2d32cdcff27785c6"></include-fragment>
    `;

    expect(getHeadRef(document)).toBe("12322913653a4b271361ebac2d32cdcff27785c6");
  });
});
