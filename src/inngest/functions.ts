import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import prisma from "@/lib/db";
import { topologicalSort } from "./utils";
import { ExecutionStatus, NodeType } from "@/generated/prisma";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { httpRequestChannel } from "./channels/http-request";
import { manualTriggerChannel } from "./channels/manual-trigger";
import { googleFormTriggerChannel } from "./channels/google-form-trigger";
import { stripeTriggerChannel } from "./channels/stripe-trigger";
import { geminiChannel } from "./channels/gemini";
import { openAiChannel } from "./channels/openai";
import { anthropicChannel } from "./channels/anthropic";
import { discordChannel } from "./channels/discord";
import { slackChannel } from "./channels/slack";
import { filterChannel } from "./channels/filter";
import { gmailChannel } from "./channels/gmail";
import { googleSheetsChannel } from "./channels/google-sheets";
import { routerChannel } from "./channels/router";

export const executeWorkflow = inngest.createFunction(
  { 
    id: "execute-workflow",
    retries: process.env.NODE_ENV === "production" ? 3 : 0,
    onFailure: async ({ event, step }) => {
      return prisma.execution.update({
        where: { inngestEventId: event.data.event.id },
        data: {
          status: ExecutionStatus.FAILED,
          error: event.data.error.message,
          errorStack: event.data.error.stack,
        },
      });
    },
  },
  { 
    event: "workflows/execute.workflow",
    channels: [
      httpRequestChannel(),
      manualTriggerChannel(),
      googleFormTriggerChannel(),
      stripeTriggerChannel(),
      geminiChannel(),
      openAiChannel(),
      anthropicChannel(),
      discordChannel(),
      slackChannel(),
      filterChannel(),
      gmailChannel(),
      googleSheetsChannel(),
      routerChannel(),
    ],
  },
  async ({ event, step, publish }) => {
    const inngestEventId = event.id;
    const workflowId = event.data.workflowId;

    if (!inngestEventId || !workflowId) {
      throw new NonRetriableError("Event ID or workflow ID is missing");
    }

    await step.run("create-execution", async () => {
      return prisma.execution.create({
        data: {
          workflowId,
          inngestEventId,
        },
      });
    });

    const { sortedNodes, connections } = await step.run("prepare-workflow", async () => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id: workflowId },
        include: {
          nodes: true,
          connections: true,
        },
      });

      return {
        sortedNodes: topologicalSort(workflow.nodes, workflow.connections),
        connections: workflow.connections,
      };
    });

    const userId = await step.run("find-user-id", async () => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id: workflowId },
        select: {
          userId: true,
        },
      });

      return workflow.userId;
    });

    // Initialize context with any initial data from the trigger
    let context = event.data.initialData || {};

    // Build a map of connections by source node for Router support
    const connectionsBySource = new Map<string, typeof connections>();
    for (const conn of connections) {
      const existing = connectionsBySource.get(conn.fromNodeId) || [];
      existing.push(conn);
      connectionsBySource.set(conn.fromNodeId, existing);
    }

    // Track which nodes have been executed (for Router branching)
    const executedNodes = new Set<string>();

    // Check if workflow has any Router nodes
    const hasRouter = sortedNodes.some(
      (n) => (n.type as NodeType) === NodeType.ROUTER,
    );

    if (hasRouter) {
      // Graph-aware execution for workflows with Router nodes
      const nodeMap = new Map(sortedNodes.map((n) => [n.id, n]));

      // Find root nodes (nodes with no incoming connections)
      const nodesWithIncoming = new Set(connections.map((c) => c.toNodeId));
      const rootNodes = sortedNodes.filter((n) => !nodesWithIncoming.has(n.id));

      const executeNode = async (nodeId: string): Promise<void> => {
        if (executedNodes.has(nodeId)) return;
        executedNodes.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) return;

        const executor = getExecutor(node.type as NodeType);
        context = await executor({
          data: node.data as Record<string, unknown>,
          nodeId: node.id,
          userId,
          context,
          step,
          publish,
        });

        // If this was a Filter node that didn't pass, stop
        if (context.__filtered) {
          return;
        }

        const outConnections = connectionsBySource.get(nodeId) || [];

        if ((node.type as NodeType) === NodeType.ROUTER) {
          // Follow only the matching output path
          const routerResult = context.__routerResult as boolean;
          const outputKey = routerResult ? "true" : "false";
          const matchingConns = outConnections.filter(
            (c) => c.fromOutput === outputKey,
          );
          for (const conn of matchingConns) {
            await executeNode(conn.toNodeId);
          }
        } else {
          // Follow all output connections (normal behavior)
          for (const conn of outConnections) {
            await executeNode(conn.toNodeId);
          }
        }
      };

      for (const rootNode of rootNodes) {
        await executeNode(rootNode.id);
      }
    } else {
      // Simple linear execution for workflows without Router nodes
      for (const node of sortedNodes) {
        const executor = getExecutor(node.type as NodeType);
        context = await executor({
          data: node.data as Record<string, unknown>,
          nodeId: node.id,
          userId,
          context,
          step,
          publish,
        });

        // If a Filter node stops the workflow, break out
        if (context.__filtered) {
          break;
        }
      }
    }

    await step.run("update-execution", async () => {
      return prisma.execution.update({
        where: { inngestEventId, workflowId },
        data: {
          status: ExecutionStatus.SUCCESS,
          completedAt: new Date(),
          output: context,
        },
      })
    });

    return {
      workflowId,
      result: context,
    };
  },
);
