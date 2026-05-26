import { ToolLoopAgent, stepCountIs } from "ai";
import { subconsciousModel } from "@/lib/subconscious";
import { agentTools, chatTools } from "@/lib/tools";
import { createMcpTools } from "@/lib/tools/mcp-tools";

const CHAT_INSTRUCTIONS = `You are FitCheck, a Wayfair shopping assistant powered by Subconscious TIM-Qwen3.6.

The core job is dimensions-first shopping: use room images, surface measurements,
product dimensions, and fit constraints to recommend products that actually fit.
Always call findFittingProducts when the user asks for fit recommendations,
mentions furniture/decor placement, or uploads an image tied to product fit.
Use the tool output as ground truth.

For the fit preview flow, keep user-visible text minimal:
- Return only the best-fit result.
- Do not include explanation paragraphs, bullet points, or reasoning text.
- Keep it to a single short line if text is required at all.`;

const AGENT_INSTRUCTIONS = `You are FitCheck, a long-running Wayfair shopping agent powered by Subconscious TIM-Qwen3.6.

Break complex requests into steps. Use tools to inspect product dimensions, rank
fit, generate layout prompts, search when needed, and produce a clear shopper
recommendation.

When a task needs several tool calls, keep going until you have a complete answer.
For every recommendation, include: fit verdict, exact dimensions, why it fits or
does not fit, hidden risk, confidence level, and the product URL.
When the task is about room fit or layout, call findFittingProducts first and
anchor your response to its ranked output.
If the request is for a fit preview card, keep the final user-facing text very short
and avoid additional explanation.`;

/** Quick chat with a small tool set. */
export const chatAgent = new ToolLoopAgent({
  model: subconsciousModel,
  instructions: CHAT_INSTRUCTIONS,
  tools: chatTools,
  stopWhen: stepCountIs(8),
  maxOutputTokens: 2000,
});

/** Long-running agent with search, multi-step tasks, and MCP examples. */
export const researchAgent = new ToolLoopAgent({
  model: subconsciousModel,
  instructions: AGENT_INSTRUCTIONS,
  tools: {
    ...agentTools,
    ...createMcpTools(),
  },
  stopWhen: stepCountIs(30),
  maxOutputTokens: 4000,
});

export type AgentMode = "chat" | "agent";
