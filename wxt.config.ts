import { defineConfig } from "wxt";

import {
  devinRedirectIconPath,
  extensionDescription,
  extensionName,
  manifestIconPaths,
} from "./lib/github-enhancer-metadata";

export const manifest = {
  name: extensionName,
  description: extensionDescription,
  permissions: ["storage"],
  host_permissions: ["https://github.com/*"],
  web_accessible_resources: [
    {
      resources: [devinRedirectIconPath],
      matches: ["https://github.com/*"],
    },
  ],
  icons: manifestIconPaths,
};

const config = defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest,
});

export default config;
