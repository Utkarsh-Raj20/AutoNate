"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { filterChannel } from "@/inngest/channels/filter";
import { inngest } from "@/inngest/client";

export type FilterToken = Realtime.Token<
  typeof filterChannel,
  ["status"]
>;

export async function fetchFilterRealtimeToken(): Promise<FilterToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: filterChannel(),
    topics: ["status"],
  });

  return token;
};
