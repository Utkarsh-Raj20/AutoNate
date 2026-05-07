import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "@/features/executions/types";
import { gmailChannel } from "@/inngest/channels/gmail";
import ky from "ky";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type GmailData = {
  variableName?: string;
  apiKey?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
};

export const gmailExecutor: NodeExecutor<GmailData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    gmailChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.to) {
    await publish(
      gmailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Gmail node: Recipient email (To) is required");
  }

  if (!data.subject) {
    await publish(
      gmailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Gmail node: Subject is required");
  }

  if (!data.apiKey) {
    await publish(
      gmailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Gmail node: Resend API Key is required");
  }

  const resolvedTo = decode(Handlebars.compile(data.to)(context));
  const resolvedSubject = decode(Handlebars.compile(data.subject)(context));
  const resolvedBody = data.body
    ? decode(Handlebars.compile(data.body)(context))
    : "";
  const resolvedFrom = data.from
    ? decode(Handlebars.compile(data.from)(context))
    : "AutoNate <onboarding@resend.dev>";

  try {
    const result = await step.run("gmail-send-email", async () => {
      const response = await ky.post("https://api.resend.com/emails", {
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
        },
        json: {
          from: resolvedFrom,
          to: resolvedTo.split(",").map((e) => e.trim()),
          subject: resolvedSubject,
          html: resolvedBody,
        },
      });

      const responseData = await response.json<{ id: string }>();

      if (!data.variableName) {
        await publish(
          gmailChannel().status({
            nodeId,
            status: "error",
          }),
        );
        throw new NonRetriableError("Gmail node: Variable name is missing");
      }

      return {
        ...context,
        [data.variableName]: {
          emailId: responseData.id,
          to: resolvedTo,
          subject: resolvedSubject,
          from: resolvedFrom,
        },
      };
    });

    await publish(
      gmailChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await publish(
      gmailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
