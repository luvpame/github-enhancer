export const githubEnhancerPingType = "github-enhancer:ping";
export const githubEnhancerPongType = "github-enhancer:pong";

export interface GithubEnhancerPingMessage {
  type: typeof githubEnhancerPingType;
}

export interface GithubEnhancerPongMessage {
  type: typeof githubEnhancerPongType;
  browser: string;
  manifestVersion: number;
}

interface RuntimeMessenger {
  sendMessage: (message: GithubEnhancerPingMessage) => Promise<unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const createPingMessage = (): GithubEnhancerPingMessage => ({
  type: githubEnhancerPingType,
});

export const createPongMessage = (
  browser: string,
  manifestVersion: number,
): GithubEnhancerPongMessage => ({
  type: githubEnhancerPongType,
  browser,
  manifestVersion,
});

export const isPingMessage = (value: unknown): value is GithubEnhancerPingMessage =>
  isRecord(value) && value.type === githubEnhancerPingType;

export const isPongMessage = (value: unknown): value is GithubEnhancerPongMessage =>
  isRecord(value) &&
  value.type === githubEnhancerPongType &&
  typeof value.browser === "string" &&
  typeof value.manifestVersion === "number";

export const pingBackground = async (
  runtime: RuntimeMessenger,
): Promise<GithubEnhancerPongMessage> => {
  const response = await runtime.sendMessage(createPingMessage());

  if (!isPongMessage(response)) {
    throw new Error("Unexpected response from the background script.");
  }

  return response;
};
