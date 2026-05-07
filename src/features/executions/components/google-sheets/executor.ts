import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "@/features/executions/types";
import { googleSheetsChannel } from "@/inngest/channels/google-sheets";
import ky from "ky";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type GoogleSheetsData = {
  variableName?: string;
  spreadsheetId?: string;
  sheetName?: string;
  apiKey?: string;
  rowValues?: string;
};

export const googleSheetsExecutor: NodeExecutor<GoogleSheetsData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    googleSheetsChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.spreadsheetId) {
    await publish(
      googleSheetsChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Google Sheets node: Spreadsheet ID is required");
  }

  if (!data.apiKey) {
    await publish(
      googleSheetsChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Google Sheets node: Google API Key is required");
  }

  if (!data.rowValues) {
    await publish(
      googleSheetsChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Google Sheets node: Row values are required");
  }

  const sheetName = data.sheetName || "Sheet1";

  try {
    const result = await step.run("google-sheets-append", async () => {
      // Parse row values — each line becomes a cell in the row
      const lines = data.rowValues!.split("\n").filter((line) => line.trim() !== "");
      const resolvedValues = lines.map((line) => {
        const compiled = Handlebars.compile(line.trim())(context);
        return decode(compiled);
      });

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${data.spreadsheetId}/values/${encodeURIComponent(sheetName)}:append`;

      await ky.post(url, {
        searchParams: {
          valueInputOption: "USER_ENTERED",
          key: data.apiKey!,
        },
        json: {
          values: [resolvedValues],
        },
      });

      if (!data.variableName) {
        await publish(
          googleSheetsChannel().status({
            nodeId,
            status: "error",
          }),
        );
        throw new NonRetriableError("Google Sheets node: Variable name is missing");
      }

      return {
        ...context,
        [data.variableName]: {
          spreadsheetId: data.spreadsheetId,
          sheetName,
          appendedValues: resolvedValues,
          rowCount: resolvedValues.length,
        },
      };
    });

    await publish(
      googleSheetsChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await publish(
      googleSheetsChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
