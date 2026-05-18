import { describe, expect, it } from "vite-plus/test";

import { getToggleItems } from "../entrypoints/popup/app";

describe("popup toggle items", () => {
  it("shows the two feature toggles in stable order", () => {
    expect(getToggleItems()).toEqual([
      {
        key: "prCopyEnabled",
        label: "PR copy",
        description: "Add Title, Url, and Textlink copy buttons to pull requests.",
      },
      {
        key: "htmlPreviewEnabled",
        label: "HTML preview",
        description: "Add Preview HTML buttons to changed HTML files.",
      },
    ]);
  });
});
