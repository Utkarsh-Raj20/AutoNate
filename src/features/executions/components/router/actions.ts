"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { routerChannel } from "@/inngest/channels/router";
import { inngest } from "@/inngest/client";

export type RouterToken = Realtime.Token<
  typeof routerChannel,
  ["status"]
>;

export async function fetchRouterRealtimeToken(): Promise<RouterToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: routerChannel(),
    topics: ["status"],
  });

  return token;
};
