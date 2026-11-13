import { describe, expect, it, vi } from "vitest";
import type { ExecutorDeps } from "./executor-deps.js";
import { connectorTrustKeys, createRunTrustLoaders } from "./run-trust.js";

describe("connectorTrustKeys", () => {
  const providers = ["gmail", "slack"];

  it("keys a batch by the app each action reaches", () => {
    expect(
      connectorTrustKeys(
        ["GMAIL_LIST_THREADS", "SLACK_LIST_CHANNELS", "NOTION_SEARCH"],
        { connectorId: "composio" },
        "composio",
        providers,
      ),
    ).toEqual(["kind:composio:gmail", "kind:composio:slack", "kind:composio:notion_search"]);
  });

  it("keeps the same action on two MCP servers apart", () => {
    const keys = (resourceId: string) =>
      connectorTrustKeys(
        ["GMAIL_LIST_THREADS"],
        { connectorId: "mcp", resourceId },
        "mcp",
        providers,
      );
    expect(keys("server-a")).toEqual(["resource:mcp:server-a:gmail"]);
    expect(keys("server-b")).not.toEqual(keys("server-a"));
  });

  it("keys a call that is not a batch by its connection", () => {
    expect(
      connectorTrustKeys(undefined, { connectorId: "mcp", resourceId: "server-a" }, "mcp", []),
    ).toEqual(["resource:mcp:server-a"]);
  });
});

describe("createRunTrustLoaders", () => {
  function loaders(input: { trustedChannelWords?: string; channelText?: string }) {
    const deps = {
      prisma: { externalEffect: { findMany: vi.fn(async () => []) } },
    } as unknown as ExecutorDeps;
    return createRunTrustLoaders(deps, {
      run: { userId: "user-1", spaceId: "space-1", trigger: "messaging" },
      runId: "run-1",
      botId: "bot-1",
      taskPrompt: "",
      ownerStartedRun: false,
      messagingChannelRun: false,
      sourceMessage: {
        role: "user",
        blocks: [{ kind: "channel_message", text: input.channelText ?? "" }],
      },
      connectedPlugins: [],
      trustedChannelWords: input.trustedChannelWords,
    });
  }

  it("trusts the sites a trusted group's members linked", async () => {
    const trust = loaders({
      trustedChannelWords: "https://a.example/d/abc\nCan we budget for this?",
    });
    expect(await trust.loadTrustedSites()).toEqual(new Set(["a.example"]));
  });

  it("does not trust a link in another group's message", async () => {
    const trust = loaders({ channelText: "https://a.example/d/abc" });
    expect(await trust.loadTrustedSites()).toEqual(new Set());
  });
});
