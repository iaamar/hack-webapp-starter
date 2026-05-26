# FitCheck: Dimension-First Shopping Agent

FitCheck is a Wayfair customer-track hack built on this Subconscious starter.
The demo flow is now chatbot-first: upload a room image in chat, ask for a
product like “find me a plant that will fit on this table,” and receive ranked
Wayfair matches with fit confidence and a generated best-fit preview image.
For the fit-preview flow, chat output is intentionally minimal: a single winner
plus one newly generated composite image at the same source resolution.

The app uses `subconscious/tim-qwen3.6-27b` through `lib/subconscious.ts`.
Subconscious handles the vision/reasoning story from a user-provided image; the
demo keeps dimension-driven ranking and local visual-fit planning so results stay
reliable without a separate image-generation endpoint.

## Model Capability Check (`models.json`)

- `origin/main` includes `models.json`, but it currently contains API error
  payload entries rather than usable model capability records.
- Runtime checks in `lib/model-capabilities.ts` inspect `models.json` when
  present and determine whether image-editing models are available.
- Because no working image-edit endpoint is configured, preview rendering mode is
  explicitly labeled as `Local compositing fallback` in chat output.

## Demo Path

```bash
pnpm install
cp .env.example .env.local
# Set SUBCONSCIOUS_API_KEY in .env.local for live chat/tool calls
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The bundled test image is
`public/test-room.svg`. Optional standalone visual demo: `/fitcheck-demo`.

60-second script:

1. “A shopper uploads a living room photo and asks in chat: find me a plant that
   fits on this table.”
2. FitCheck detects the table surface with confidence and applies clearance plus
   sightline constraints.
3. Chat returns only the best-fit product and one generated composite preview.
4. Confidence and size labels stay visible on the generated image overlay.
5. Optional: open `/fitcheck-demo` to show the standalone visualized layout.

---

# Wayfair × Subconscious Hackathon Starter

Build AI agents on **Subconscious** (TIM-Qwen3.6) with the **Vercel AI SDK**. This repo gives you a working chat UI, long-running agent mode, example tools, and an MCP template — so you can focus on your track, not boilerplate.

**Sponsors:** Wayfair · Subconscious · Baseten · Cloudflare

---

## Pick your track

Choose one challenge. Your agent should use tools (APIs, MCP, functions) and talk to users through the built-in UI.

### Track 1 — Consumer Shopping Experience

Millions of customers shop for furniture on Wayfair every day.

**Challenge:** Build an agent that improves discovery and the buyer experience.

**Ideas to explore:**
- Style or room-based product recommendations
- “Help me furnish this room” from a photo or description
- Compare options, explain tradeoffs, answer sizing questions
- Guided search instead of endless filters

### Track 2 — Supply Chain

Wayfair and its supplier network move huge volumes of furniture worldwide.

**Challenge:** Build an agent that improves Wayfair’s ability to manage its supply chain.

**Ideas to explore:**
- Track shipments, flag delays, summarize status
- Answer “where is order X?” or “what’s at risk this week?”
- Coordinate supplier updates, inventory, or routing decisions
- Turn messy ops data into clear next steps

### Track 3 — FinOps & Customer Service

Wayfair runs ~$12B in revenue and serves ~22M customers a year.

**Challenge:** Build an agent system that improves internal operations — financial operations or customer service.

**Ideas to explore:**
- Triage support tickets and draft responses
- Look up order/billing history and explain charges
- Summarize finance or ops metrics for a team
- Route issues to the right team with context

---

## Quick start

**1. Get a Subconscious API key**

Sign up at [subconscious.dev/platform](https://www.subconscious.dev/platform) and copy your key (`sky_...`).

**2. Create a .env.local file with your Subconscious API key**

```bash
pnpm install
cp .env.example .env.local
# Set SUBCONSCIOUS_API_KEY in .env.local
```

**3. Run the app**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**4. Run the chatbot-first flow**

- Open `/` for the conversational FitCheck chatbot experience.
- Use **Image** to attach a room photo and ask a fit question.
- The assistant calls fitcheck tools to return confidence, ranked products, and
  Wayfair links.
- Ask: “Show only the best fit and generate the preview image.”
- Chat returns the minimal payload/output for this flow: one best fit + one image.
- Optional: open `/fitcheck-demo` for the standalone visual component.

---

## How to build on this repo

You mostly edit three places:

| What | Where |
|------|--------|
| Tools (APIs, data, actions) | `lib/tools/index.ts` |
| Agent behavior & prompts | `lib/agents/index.ts` |
| MCP integrations | `lib/tools/mcp-tools.ts` |

### Add a tool

Tools are functions your agent can call. Example:

```typescript
// lib/tools/index.ts
export const searchProducts = tool({
  description: "Search furniture by style, room, or keyword",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // Call your API, mock data, or Cloudflare Worker
    return { results: [] };
  },
});
```

Add it to `agentTools` in the same file, then customize the prompt in `lib/agents/index.ts` for your track.

### Connect MCP

MCP servers expose tools (files, APIs, databases). Wrap them as AI SDK tools — see `lib/tools/mcp-tools.ts`.

```bash
pnpm add @modelcontextprotocol/sdk
```

### Images (multimodal)

The UI sends images as data URLs. Useful for room photos, screenshots, or docs. Details: `.agents/skills/subconscious-dev/references/multimodal.md`.

### Long-running agents

**Agent** mode runs up to 30 tool steps (`lib/agents/index.ts`). The API allows 5-minute runs (`app/api/chat/route.ts`). Increase either if your demo needs it.

---

## What’s included

- **Subconscious provider** — `lib/subconscious.ts`
- **Chat + research agents** — `lib/agents/index.ts`
- **Example tools** — weather, calculator, web search stub, long task
- **Streaming API** — `app/api/chat/route.ts`
- **Chatbot UI** — `components/chat-app.tsx`
- **Standalone demo view** — `components/fitcheck-app.tsx` via `/fitcheck-demo`
- **Subconscious API skill** — `.agents/skills/subconscious-dev/` (for Cursor/Codex)

Re-install the skill anytime:

```bash
npx skills add https://github.com/subconscious-systems/skills --skill subconscious-dev
```

---

## Environment

| Variable | Required |
|----------|----------|
| `SUBCONSCIOUS_API_KEY` | Yes — [get one here](https://www.subconscious.dev/platform) |

---

## Deploy

Set `SUBCONSCIOUS_API_KEY` on your host, then:

```bash
pnpm build && pnpm start
```

Works on Vercel, Cloudflare, or any Node host.

---

## Links

- [Subconscious Platform](https://www.subconscious.dev/platform) — API keys
- [Subconscious Docs](https://docs.subconscious.dev)
- [Vercel AI SDK — Agents](https://ai-sdk.dev/docs/agents/overview)
- [Subconscious skills repo](https://github.com/subconscious-systems/skills)
