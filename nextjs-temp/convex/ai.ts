import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const analyzePhoto = action({
  args: { imageUrl: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY || process.env.FORGE_API_KEY;
    const apiUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";

    if (!apiKey) {
      console.error("Missing API key for AI features");
      return null;
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o", // or your preferred vision model
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this photo of a vehicle and return a JSON object with these fields:
- licensePlate: string (the license plate number, uppercase no spaces, or "" if not visible)
- vehicleMake: string (e.g. "Ford", "Chevrolet", or "" if unknown)
- vehicleModel: string (e.g. "Explorer", "Tahoe", or "" if unknown)
- vehicleColor: string (e.g. "Black", "White", or "" if unknown)
- vehicleType: string (one of: "Sedan", "SUV", "Truck", "Van", "Motorcycle", "Other")
- agencyType: string (one of: "ICE", "CBP", "DHS", "FBI", "DEA", "ATF", "USMS", "Other", or "" if no agency markings visible)
- agencyMarkings: string (describe any visible agency text, logos, or insignia, or "" if none)
- badgeNumber: string (any visible badge or unit number, or "" if not visible)
- uniformDescription: string (brief description of any visible uniform or tactical gear, or "" if none)
- confidence: number (0-1, your confidence in the agency identification)

Return ONLY valid JSON, no explanation.`,
                },
                {
                  type: "image_url",
                  image_url: { url: args.imageUrl, detail: "high" },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API failed: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "{}";
      const result = JSON.parse(content);
      
      return {
        licensePlate: (result.licensePlate || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
        vehicleMake: result.vehicleMake || "",
        vehicleModel: result.vehicleModel || "",
        vehicleColor: result.vehicleColor || "",
        vehicleType: result.vehicleType || "Other",
        agencyType: result.agencyType || "",
        agencyMarkings: result.agencyMarkings || "",
        badgeNumber: result.badgeNumber || "",
        uniformDescription: result.uniformDescription || "",
        confidence: result.confidence || 0,
      };
    } catch (error) {
      console.error("AI Analysis error:", error);
      return null;
    }
  },
});

export const generateEmbedding = action({
  args: { text: v.string(), sightingId: v.id("sightings") },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY || process.env.FORGE_API_KEY;
    const apiUrl = process.env.OPENAI_EMBEDDING_URL || "https://api.openai.com/v1/embeddings";

    if (!apiKey) return;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small", // or your preferred embedding model
          input: args.text,
        }),
      });

      if (!response.ok) throw new Error("Embedding failed");

      const data = await response.json();
      const embedding = data.data[0].embedding;

      // We need an internal mutation to update the embedding
      await ctx.runMutation(internal.ai.updateEmbedding, {
        sightingId: args.sightingId,
        embedding,
      });
    } catch (error) {
      console.error("Embedding generation error:", error);
    }
  },
});

export const updateEmbedding = mutation({
  args: { sightingId: v.id("sightings"), embedding: v.array(v.number()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sightingId, { embedding: args.embedding });
  },
});

export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY || process.env.FORGE_API_KEY;
    const embedUrl = process.env.OPENAI_EMBEDDING_URL || "https://api.openai.com/v1/embeddings";
    const chatUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";

    if (!apiKey) throw new Error("No API key available");

    // 1. Embed the query
    const embedRes = await fetch(embedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: args.message,
      }),
    });
    
    if (!embedRes.ok) throw new Error("Embedding failed");
    const embedData = await embedRes.json();
    const vector = embedData.data[0].embedding;

    // 2. Vector search via vectorIndex
    const results = await ctx.vectorSearch("sightings", "by_embedding", {
      vector,
      limit: 10,
    });

    // 3. Fetch full documents for context
    const sightingsContext = await ctx.runQuery(internal.ai.getSightingsContext, {
      ids: results.map((r) => r._id),
    });

    // 4. Send to LLM
    const contextText = JSON.stringify(sightingsContext, null, 2);
    const chatRes = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant for the ICE Watch app. Use the provided sightings context to answer the user's questions. Be concise and factual.",
          },
          {
            role: "system",
            content: `Context:\n${contextText}`,
          },
          {
            role: "user",
            content: args.message,
          }
        ],
      }),
    });

    const chatData = await chatRes.json();
    return chatData.choices[0]?.message?.content || "I couldn't generate a response.";
  },
});

export const getSightingsContext = internalQuery({
  args: { ids: v.array(v.id("sightings")) },
  handler: async (ctx, args) => {
    const sightings = [];
    for (const id of args.ids) {
      const s = await ctx.db.get(id);
      if (s && !s.isHidden) {
        sightings.push({
          plate: s.licensePlate,
          type: s.vehicleType,
          agency: s.agencyType,
          location: s.locationAddress || `${s.latitude},${s.longitude}`,
          time: s._creationTime,
        });
      }
    }
    return sightings;
  },
});
