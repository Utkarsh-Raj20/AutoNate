"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { FilterDialog, FilterFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchFilterRealtimeToken } from "./actions";
import { FILTER_CHANNEL_NAME } from "@/inngest/channels/filter";
import { FilterIcon } from "lucide-react";

type FilterNodeData = {
  field?: string;
  operator?: string;
  value?: string;
};

type FilterNodeType = Node<FilterNodeData>;

export const FilterNode = memo((props: NodeProps<FilterNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: FILTER_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchFilterRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: FilterFormValues) => {
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

  const nodeData = props.data;
  const description = nodeData?.field && nodeData?.operator
    ? `${nodeData.field} ${nodeData.operator} ${nodeData.value || ""}`
    : "Not configured";

  return (
    <>
      <FilterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={FilterIcon}
        name="Filter"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  )
});

FilterNode.displayName = "FilterNode";
