import { defineConfig } from "wxt";

import {
  extensionDescription,
  extensionName,
  manifestIconPaths,
} from "./lib/github-enhancer-metadata";

export const manifest = {
  name: extensionName,
  description: extensionDescription,
  permissions: ["storage"],
  host_permissions: ["https://github.com/*"],
  icons: manifestIconPaths,
};

const config = defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest,
});

export default config;
