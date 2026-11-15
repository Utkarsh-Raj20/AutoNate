import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { NodeExecutor } from "@/features/executions/types";
import { geminiChannel } from "@/inngest/channels/gemini";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type GeminiData = {
  variableName?: string;
  credentialId?: string;
  systemPrompt?: string;
  userPrompt?: string;
  model?: string; // Optional model selection
};

export const geminiExecutor: NodeExecutor<GeminiData> = async ({
  data,
  nodeId,
  userId,
  context,
  step,
  publish,
}) => {
  await publish(
    geminiChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.variableName) {
    await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      })
    );
    throw new NonRetriableError("Gemini node: Variable name is missing");
  }

  if (!data.credentialId) {
    await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Gemini node: Credential is required");
  }

  if (!data.userPrompt) {
    await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      })
    );
    throw new NonRetriableError("Gemini node: User prompt is missing");
  }

  const systemPrompt = data.systemPrompt
    ? Handlebars.compile(data.systemPrompt)(context)
    : "You are a helpful assistant.";
  const userPrompt = Handlebars.compile(data.userPrompt)(context);

  const credential = await step.run("get-credential", () => {
    return prisma.credential.findUnique({
      where: {
        id: data.credentialId,
        userId,
      },
    });
  });

  if (!credential) {
    await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      })
    );
    throw new NonRetriableError("Gemini node: Credential not found");
  }

  let apiKey: string;
  try {
    apiKey = decrypt(credential.value);
    // Trim any whitespace
    apiKey = apiKey.trim();
    
    // Log for debugging (only in non-production or with sanitization)
    if (process.env.NODE_ENV !== "production") {
      console.log("[Gemini Executor] API Key length:", apiKey.length);
      console.log("[Gemini Executor] API Key starts with:", apiKey.substring(0, 10));
    }
  } catch (error) {
    console.error("[Gemini Executor] Decryption failed:", error);
    await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      })
    );
    throw new NonRetriableError(
      `Gemini node: Failed to decrypt API key. Ensure ENCRYPTION_KEY is set correctly in production. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (!apiKey || apiKey.length === 0) {
    console.error("[Gemini Executor] API key is empty after decryption");
    await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      })
    );
    throw new NonRetriableError("Gemini node: Decrypted API key is empty");
  }

  // Basic validation: Gemini keys are typically 39+ characters
  // They can start with "AIza" (old format) or "AQ" (new format)
  if (apiKey.length < 30) {
    console.error("[Gemini Executor] API key appears to be too short");
    await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      })
    );
    throw new NonRetriableError(
      "Gemini node: API key appears to be invalid (too short). " +
      "Please verify you're using the correct API key from Google AI Studio."
    );
  }

  const google = createGoogleGenerativeAI({
    apiKey: apiKey,
  });

  // Use the model specified in data, or default to gemini-2.0-flash-exp
  const modelName = data.model || "gemini-2.0-flash-exp";

  try {
    const { steps } = await step.ai.wrap(
      "gemini-generate-text",
      generateText,
      {
        model: google(modelName),
        system: systemPrompt,
        prompt: userPrompt,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
        },
      },
    );

    const text = 
      steps[0].content[0].type === "text" 
        ? steps[0].content[0].text
        : "";
    
    await publish(
      geminiChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return {
      ...context,
      [data.variableName]: {
        text,
      },
    }
  } catch (error) {
     await publish(
      geminiChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
