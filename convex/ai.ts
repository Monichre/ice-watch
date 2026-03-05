import { actionGeneric } from "convex/server";
import { v } from "convex/values";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function getAiConfig() {
  const baseUrl = process.env.AI_API_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI API key is not configured. Set AI_API_KEY or OPENAI_API_KEY.");
  }
  const model = process.env.AI_MODEL ?? "gpt-4.1-mini";
  const embeddingModel = process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  return { baseUrl, apiKey, model, embeddingModel };
}

async function chatCompletion(messages: ChatMessage[], temperature = 0.2): Promise<string> {
  const { baseUrl, apiKey, model } = getAiConfig();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AI chat completion failed: ${response.status} ${message}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI response did not include message content");
  }
  return content;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const stripped = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(stripped) as Record<string, unknown>;
  return parsed;
}

export const extractPlate = actionGeneric({
  args: {
    imageUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content: "You are an ALPR assistant that extracts a single plate string.",
        },
        {
          role: "user",
          content: [
            "Extract the license plate from this image URL.",
            "Return only JSON:",
            '{ "plate": "STRING_OR_EMPTY", "confidence": 0.0 }',
            `Image URL: ${args.imageUrl}`,
          ].join("\n"),
        },
      ],
      0,
    );
    const parsed = extractJsonObject(raw);
    const plate = String(parsed.plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const confidence = Number(parsed.confidence ?? 0);
    return {
      plate,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 1)) : 0,
      raw,
    };
  },
});

export const analyzeVehicle = actionGeneric({
  args: {
    imageUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content: "You extract structured vehicle and agency fields from an image URL.",
        },
        {
          role: "user",
          content: [
            "Analyze this vehicle image and return only JSON.",
            `Image URL: ${args.imageUrl}`,
            '{',
            '  "licensePlate": "string",',
            '  "vehicleMake": "string",',
            '  "vehicleModel": "string",',
            '  "vehicleColor": "string",',
            '  "vehicleType": "Sedan|SUV|Truck|Van|Motorcycle|Other",',
            '  "agencyType": "ICE|CBP|DHS|FBI|DEA|ATF|USMS|Other|",',
            '  "agencyMarkings": "string",',
            '  "badgeNumber": "string",',
            '  "uniformDescription": "string",',
            '  "confidence": 0.0',
            "}",
          ].join("\n"),
        },
      ],
      0.1,
    );
    const parsed = extractJsonObject(raw);
    return {
      licensePlate: String(parsed.licensePlate ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
      vehicleMake: String(parsed.vehicleMake ?? ""),
      vehicleModel: String(parsed.vehicleModel ?? ""),
      vehicleColor: String(parsed.vehicleColor ?? ""),
      vehicleType: String(parsed.vehicleType ?? "Other"),
      agencyType: String(parsed.agencyType ?? ""),
      agencyMarkings: String(parsed.agencyMarkings ?? ""),
      badgeNumber: String(parsed.badgeNumber ?? ""),
      uniformDescription: String(parsed.uniformDescription ?? ""),
      confidence: Number(parsed.confidence ?? 0),
      raw,
    };
  },
});

export const embedText = actionGeneric({
  args: {
    content: v.string(),
  },
  handler: async (_ctx, args) => {
    const { baseUrl, apiKey, embeddingModel } = getAiConfig();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: args.content,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Embedding request failed: ${response.status} ${message}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = data.data?.[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error("Embedding response was empty");
    }
    return embedding;
  },
});
