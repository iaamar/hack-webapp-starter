import { tool } from "ai";
import { z } from "zod";
import { rankProductsForScene } from "@/lib/fitcheck-agent";
import { roomScenes } from "@/lib/fitcheck-data";
import { inspectModelsCatalog } from "@/lib/model-capabilities";

/**
 * Example tools for the hackathon starter.
 *
 * Add your own tools here — connect APIs, databases, Cloudflare Workers,
 * Baseten endpoints, or wrap MCP server tools (see lib/tools/mcp-tools.ts).
 */
export const getWeather = tool({
  description: "Get the current weather for a city",
  inputSchema: z.object({
    city: z.string().describe("City name, e.g. Boston"),
    units: z
      .enum(["fahrenheit", "celsius"])
      .optional()
      .describe("Temperature units"),
  }),
  execute: async ({ city, units = "fahrenheit" }) => {
    const tempF = 55 + Math.floor(Math.random() * 30);
    const tempC = Math.round(((tempF - 32) * 5) / 9);
    return {
      city,
      condition: ["sunny", "cloudy", "rainy", "windy"][
        Math.floor(Math.random() * 4)
      ],
      temperature: units === "celsius" ? tempC : tempF,
      units,
      source: "demo-tool",
    };
  },
});

export const calculate = tool({
  description: "Evaluate a basic math expression (numbers and + - * / parentheses)",
  inputSchema: z.object({
    expression: z
      .string()
      .describe("Math expression, e.g. (17 * 23) + 4"),
  }),
  execute: async ({ expression }) => {
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
    if (!sanitized.trim()) {
      return { error: "Invalid expression" };
    }
    const result = Function(`"use strict"; return (${sanitized})`)();
    return { expression, result };
  },
});

export const webSearch = tool({
  description:
    "Search the web for information. Replace this stub with Tavily, SerpAPI, or your own search API.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    maxResults: z.number().min(1).max(10).optional(),
  }),
  execute: async ({ query, maxResults = 3 }) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      query,
      results: Array.from({ length: maxResults }, (_, i) => ({
        title: `Result ${i + 1} for "${query}"`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}&r=${i + 1}`,
        snippet:
          "Replace lib/tools/index.ts webSearch with a real API call during the hackathon.",
      })),
      note: "Stub — wire up a real search provider to go further.",
    };
  },
});

export const runLongTask = tool({
  description:
    "Run a multi-step background task. Use for demos of long-running agent work.",
  inputSchema: z.object({
    taskName: z.string().describe("Short label for the task"),
    steps: z
      .number()
      .min(1)
      .max(8)
      .optional()
      .describe("Number of simulated steps"),
  }),
  execute: async ({ taskName, steps = 4 }) => {
    const log: string[] = [];
    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      log.push(`Step ${i}/${steps}: processed "${taskName}"`);
    }
    return {
      taskName,
      status: "complete",
      stepsCompleted: steps,
      log,
    };
  },
});

export const findFittingProducts = tool({
  description:
    "Detect the target room surface, rank products internally, and return a minimal best-fit payload for image preview rendering.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        'User shopping request, e.g. "find me a plant that fits on this table"',
      ),
    sceneId: z
      .string()
      .optional()
      .describe("Detected room scene id. Defaults to the bundled test room."),
  }),
  execute: async ({ query, sceneId }) => {
    const scene =
      roomScenes.find((candidate) => candidate.id === sceneId) ?? roomScenes[0];
    const result = rankProductsForScene(scene, query);
    const modelCapabilitySummary = await inspectModelsCatalog();
    const bestFit = result.rankedProducts[0];

    const visualPreviewMode = {
      mode: modelCapabilitySummary.supportsImageEditing
        ? "model-capable-local-composite"
        : "local-composite",
      variantCount: 1,
    };

    return {
      bestFit: {
        id: bestFit.product.id,
        name: bestFit.product.name,
        verdict: bestFit.verdict,
        fitConfidence: bestFit.score,
        dimensions: bestFit.product.dimensions,
        productUrl: bestFit.product.productUrl,
      },
      surface: {
        sceneId: result.surfaceDetection.sceneId,
        surfaceName: result.surfaceDetection.surfaceName,
        confidence: result.surfaceDetection.confidence,
        confidenceLabel: result.surfaceDetection.confidenceLabel,
        dimensions: scene.surfaceDimensions,
      },
      preview: visualPreviewMode,
    };
  },
});

export const chatTools = {
  getWeather,
  calculate,
  findFittingProducts,
};

export const agentTools = {
  getWeather,
  calculate,
  webSearch,
  runLongTask,
  findFittingProducts,
};
