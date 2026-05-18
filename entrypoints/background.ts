import { browser } from "wxt/browser";

import { extensionName } from "../lib/github-enhancer-metadata";
import {
  createPongMessage,
  isPingMessage,
  type GithubEnhancerPongMessage,
} from "../lib/github-enhancer-protocol";

export interface BackgroundApi {
  runtime: {
    onInstalled: {
      addListener: (listener: () => void) => void;
    };
    onMessage: {
      addListener: (
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: GithubEnhancerPongMessage) => void,
        ) => boolean | undefined,
      ) => void;
    };
  };
}

type MessageHandler = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: GithubEnhancerPongMessage) => void,
) => boolean | undefined;

export const createMessageHandler =
  (browserName: string, manifestVersion: number): MessageHandler =>
  (message, _sender, sendResponse) => {
    if (!isPingMessage(message)) {
      return undefined;
    }

    sendResponse(createPongMessage(browserName, manifestVersion));

    return undefined;
  };

export const registerBackground = (
  api: BackgroundApi,
  browserName: string,
  manifestVersion: number,
): void => {
  api.runtime.onInstalled.addListener(() => {
    console.info(`${extensionName} installed`);
  });

  api.runtime.onMessage.addListener(createMessageHandler(browserName, manifestVersion));
};

export default defineBackground(() => {
  registerBackground(
    browser,
    import.meta.env.BROWSER,
    browser.runtime.getManifest().manifest_version,
  );
});
