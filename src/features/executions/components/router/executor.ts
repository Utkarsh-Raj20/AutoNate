import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "@/features/executions/types";
import { routerChannel } from "@/inngest/channels/router";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type RouterOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "lessThan"
  | "contains"
  | "notContains"
  | "isEmpty"
  | "isNotEmpty";

type RouterData = {
  variableName?: string;
  field?: string;
  operator?: RouterOperator;
  value?: string;
};

const evaluateCondition = (
  fieldValue: string,
  operator: RouterOperator,
  compareValue: string,
): boolean => {
  const numField = Number(fieldValue);
  const numCompare = Number(compareValue);

  switch (operator) {
    case "equals":
      return fieldValue === compareValue;
    case "notEquals":
      return fieldValue !== compareValue;
    case "greaterThan":
      return !isNaN(numField) && !isNaN(numCompare) && numField > numCompare;
    case "lessThan":
      return !isNaN(numField) && !isNaN(numCompare) && numField < numCompare;
    case "contains":
      return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
    case "notContains":
      return !fieldValue.toLowerCase().includes(compareValue.toLowerCase());
    case "isEmpty":
      return !fieldValue || fieldValue.trim() === "";
    case "isNotEmpty":
      return !!fieldValue && fieldValue.trim() !== "";
    default:
      return false;
  }
};

export const routerExecutor: NodeExecutor<RouterData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    routerChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.field) {
    await publish(
      routerChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Router node: Field to check is required");
  }

  if (!data.operator) {
    await publish(
      routerChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Router node: Operator is required");
  }

  try {
    const result = await step.run("router-evaluate", async () => {
      const rawField = Handlebars.compile(data.field!)(context);
      const fieldValue = decode(rawField);

      const compareValue = data.value
        ? decode(Handlebars.compile(data.value)(context))
        : "";

      const passes = evaluateCondition(fieldValue, data.operator!, compareValue);

      if (!data.variableName) {
        await publish(
          routerChannel().status({
            nodeId,
            status: "error",
          }),
        );
        throw new NonRetriableError("Router node: Variable name is missing");
      }

      return {
        ...context,
        [data.variableName]: {
          result: passes,
          fieldValue,
          operator: data.operator,
          compareValue,
        },
        // This flag tells the engine which output path to follow
        __routerResult: passes,
        __routerNodeId: nodeId,
      };
    });

    await publish(
      routerChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await publish(
      routerChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
