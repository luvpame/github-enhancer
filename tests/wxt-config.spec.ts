import { describe, expect, it } from "vite-plus/test";

import config, { manifest } from "../wxt.config";
import {
  extensionDescription,
  extensionName,
  manifestIconPaths,
} from "../lib/github-enhancer-metadata";

describe("wxt config", () => {
  it("keeps the template minimal while enabling React", () => {
    expect(config.modules).toContain("@wxt-dev/module-react");
    expect(manifest.name).toBe(extensionName);
    expect(manifest.description).toBe(extensionDescription);
    expect(manifest.icons).toMatchObject(manifestIconPaths);
    expect(manifest.permissions).toContain("storage");
    expect(manifest.host_permissions).toContain("https://github.com/*");
    expect(manifest.host_permissions).toContain("https://raw.githubusercontent.com/*");
  });
});
