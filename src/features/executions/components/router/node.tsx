"use client";

import { Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { RouterDialog, RouterFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchRouterRealtimeToken } from "./actions";
import { ROUTER_CHANNEL_NAME } from "@/inngest/channels/router";
import { GitBranchIcon } from "lucide-react";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
import { BaseHandle } from "@/components/react-flow/base-handle";
import { WorkflowNode } from "@/components/workflow-node";
import { type NodeStatus, NodeStatusIndicator } from "@/components/react-flow/node-status-indicator";

type RouterNodeData = {
  field?: string;
  operator?: string;
  value?: string;
};

type RouterNodeType = Node<RouterNodeData>;

export const RouterNode = memo((props: NodeProps<RouterNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes, setEdges } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: ROUTER_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchRouterRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: RouterFormValues) => {
    setNodes((nodes) => nodes.map((node) => {
      if (node.id === props.id) {
        return {
          ...node,
          data: {
            ...node.data,
            ...values,
          }
        }
      }
      return node;
    }))
  };

  const handleDelete = () => {
    setNodes((currentNodes) => {
      return currentNodes.filter((node) => node.id !== props.id);
    });

    setEdges((currentEdges) => {
      return currentEdges.filter(
        (edge) => edge.source !== props.id && edge.target !== props.id
      );
    });
  };

  const nodeData = props.data;
  const description = nodeData?.field && nodeData?.operator
    ? `If ${nodeData.field} ${nodeData.operator} ${nodeData.value || ""}`
    : "Not configured";

  return (
    <>
      <RouterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <WorkflowNode
        name="Router"
        description={description}
        onDelete={handleDelete}
        onSettings={handleOpenSettings}
      >
        <NodeStatusIndicator
          status={nodeStatus as NodeStatus}
          variant="border"
        >
          <BaseNode status={nodeStatus as NodeStatus} onDoubleClick={handleOpenSettings}>
            <BaseNodeContent>
              <GitBranchIcon className="size-4 text-muted-foreground" />
              {/* Input handle */}
              <BaseHandle
                id="target-1"
                type="target"
                position={Position.Left}
              />
              {/* True output handle (top) */}
              <BaseHandle
                id="source-true"
                type="source"
                position={Position.Right}
                style={{ top: "30%" }}
              />
              {/* False output handle (bottom) */}
              <BaseHandle
                id="source-false"
                type="source"
                position={Position.Right}
                style={{ top: "70%" }}
              />
            </BaseNodeContent>
          </BaseNode>
        </NodeStatusIndicator>
      </WorkflowNode>
    </>
  )
});

RouterNode.displayName = "RouterNode";
