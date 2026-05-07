import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "@/features/executions/types";
import { filterChannel } from "@/inngest/channels/filter";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type FilterOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "lessThan"
  | "contains"
  | "notContains"
  | "isEmpty"
  | "isNotEmpty";

type FilterData = {
  variableName?: string;
  field?: string;
  operator?: FilterOperator;
  value?: string;
};

const evaluateCondition = (
  fieldValue: string,
  operator: FilterOperator,
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

export const filterExecutor: NodeExecutor<FilterData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    filterChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.field) {
    await publish(
      filterChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Filter node: Field to check is required");
  }

  if (!data.operator) {
    await publish(
      filterChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Filter node: Operator is required");
  }

  try {
    const result = await step.run("filter-evaluate", async () => {
      const rawField = Handlebars.compile(data.field!)(context);
      const fieldValue = decode(rawField);

      const compareValue = data.value
        ? decode(Handlebars.compile(data.value)(context))
        : "";

      const passes = evaluateCondition(fieldValue, data.operator!, compareValue);

      if (!data.variableName) {
        await publish(
          filterChannel().status({
            nodeId,
            status: "error",
          }),
        );
        throw new NonRetriableError("Filter node: Variable name is missing");
      }

      return {
        ...context,
        [data.variableName]: {
          passed: passes,
          fieldValue,
          operator: data.operator,
          compareValue,
        },
        __filtered: !passes,
      };
    });

    await publish(
      filterChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await publish(
      filterChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
