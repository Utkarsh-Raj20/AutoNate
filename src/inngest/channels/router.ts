import { channel, topic } from "@inngest/realtime";

export const ROUTER_CHANNEL_NAME = "router-execution";

export const routerChannel = channel(ROUTER_CHANNEL_NAME)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "success" | "error";
    }>(),
  );
