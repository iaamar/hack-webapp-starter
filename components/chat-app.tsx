"use client";

import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState } from "react";
import { FitPreviewGallery } from "@/components/fit-preview-gallery";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface FitDimensions {
  width: number;
  depth: number;
  height: number;
}

interface BestFitProduct {
  id: string;
  name: string;
  verdict: string;
  fitConfidence: number;
  dimensions: FitDimensions;
  productUrl: string;
}

interface FindFittingProductsOutput {
  bestFit: BestFitProduct;
  surface: {
    sceneId: string;
    surfaceName: string;
    confidence: number;
    confidenceLabel: string;
    dimensions: FitDimensions;
  };
  preview: {
    mode: string;
    variantCount: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFindFittingProductsOutput(
  value: unknown,
): value is FindFittingProductsOutput {
  if (!isRecord(value)) return false;
  if (!isRecord(value.surface)) return false;
  if (!isRecord(value.bestFit)) return false;
  if (!isRecord(value.preview)) return false;
  return (
    typeof value.surface.surfaceName === "string" &&
    typeof value.bestFit.name === "string"
  );
}

function getImageUrlFromMessage(message: UIMessage): string | null {
  for (const part of message.parts) {
    if (part.type === "file" && part.mediaType?.startsWith("image/")) {
      return part.url;
    }
  }
  return null;
}

function hasFitToolOutput(message: UIMessage): boolean {
  for (const part of message.parts) {
    if (!part.type.startsWith("tool-")) {
      continue;
    }
    const label = part.type.replace("tool-", "");
    const state = "state" in part ? part.state : "unknown";
    if (
      label === "findFittingProducts" &&
      state === "output-available" &&
      "output" in part &&
      isFindFittingProductsOutput(part.output)
    ) {
      return true;
    }
  }
  return false;
}

function MessagePart({
  part,
  messageId,
  index,
  roomImageUrl,
}: {
  part: UIMessage["parts"][number];
  messageId: string;
  index: number;
  roomImageUrl?: string;
}) {
  if (part.type === "text") {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</p>
    );
  }

  if (part.type === "file" && part.mediaType?.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={part.url}
        alt={part.filename ?? "Uploaded image"}
        className="mt-2 max-h-48 rounded-lg border border-zinc-800 object-contain"
      />
    );
  }

  if (part.type.startsWith("tool-")) {
    const label = part.type.replace("tool-", "");
    const state = "state" in part ? part.state : "unknown";

    if (
      label === "findFittingProducts" &&
      state === "output-available" &&
      "output" in part &&
      isFindFittingProductsOutput(part.output)
    ) {
      const fitcheck = part.output;
      const sourceImageUrl = roomImageUrl ?? "/test-room.svg";

      return (
        <div
          key={`${messageId}-tool-${index}`}
          className="mt-2 space-y-2 rounded-xl border border-[#FF5C28]/30 bg-[rgb(255_92_40/0.12)] px-3 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#FF5C28] px-2.5 py-1 text-xs font-semibold text-black">
              Best fit
            </span>
            <a
              href={fitcheck.bestFit.productUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-zinc-100 underline decoration-zinc-500 underline-offset-2 hover:text-[#FFB29C]"
            >
              {fitcheck.bestFit.name}
            </a>
          </div>

          <FitPreviewGallery
            roomImageUrl={sourceImageUrl}
            surfaceName={fitcheck.surface.surfaceName}
            surfaceDimensions={fitcheck.surface.dimensions}
            surfaceConfidence={fitcheck.surface.confidence}
            confidenceLabel={fitcheck.surface.confidenceLabel}
            bestFit={fitcheck.bestFit}
            previewMode={fitcheck.preview.mode}
          />
        </div>
      );
    }

    if (label === "findFittingProducts" && state === "input-available") {
      return (
        <div
          key={`${messageId}-tool-${index}`}
          className="mt-2 h-56 w-full animate-pulse rounded-xl border border-zinc-700 bg-zinc-900/60"
        />
      );
    }

    if (label === "findFittingProducts") {
      return null;
    }

    return (
      <div
        key={`${messageId}-tool-${index}`}
        className="mt-2 rounded-lg border border-[#FF5C28]/30 bg-[rgb(255_92_40/0.12)] px-3 py-2 text-xs"
      >
        <div className="font-medium text-[#FF5C28]">Tool: {label}</div>
        <div className="mt-1 text-zinc-400">
          {state === "input-available" && "Calling…"}
          {state === "output-available" && "Done"}
          {state === "output-error" && "Error"}
        </div>
      </div>
    );
  }

  return null;
}

export function ChatApp() {
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { mode: "chat" },
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  const isBusy = status === "streaming" || status === "submitted";
  const latestImageByMessageId = useMemo(() => {
    const contextMap = new Map<string, string>();
    let latestImage: string | null = null;

    for (const message of messages) {
      const imageUrl = getImageUrlFromMessage(message);
      if (imageUrl) {
        latestImage = imageUrl;
      }
      if (latestImage) {
        contextMap.set(message.id, latestImage);
      }
    }

    return contextMap;
  }, [messages]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text && !imageFile) return;

    const parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string; filename?: string }
    > = [];

    if (imageFile) {
      parts.push({
        type: "file",
        mediaType: imageFile.type || "image/png",
        url: await fileToDataUrl(imageFile),
        filename: imageFile.name,
      });
    }

    if (text) {
      parts.push({ type: "text", text });
    }

    sendMessage({ parts });
    setInput("");
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex min-h-full flex-col bg-black">
      <header className="border-b border-zinc-800 bg-black">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#FF5C28]">
              Hackathon Starter
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              FitCheck Conversational Chatbot
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Wayfair · Subconscious TIM-Qwen3.6 · Dimensions-first fit logic
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-300">
              Chatbot-first flow
            </span>
            <Link
              href="/fitcheck-demo"
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-[#FF5C28] hover:text-[#FF5C28]"
            >
              Open standalone Fitcheck demo
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
          <p>
            <span className="font-medium text-[#FF5C28]">Ask in chat</span> for a fit
            preview and the response shows only the best-fit product plus a generated
            image.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          {messages.length === 0 && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-zinc-500">
              <p className="text-lg font-medium text-zinc-200">
                Start with a conversational shopping request
              </p>
              <ul className="mt-4 max-w-md space-y-2 text-sm">
                <li>“Find me a plant that fits on this table.”</li>
                <li>“Use this image and show only the best fit.”</li>
                <li>“Generate a fitted preview image.”</li>
                <li>Attach a room image, then ask for recommendations.</li>
              </ul>
            </div>
          )}

          {messages.map((message) => {
            const suppressAssistantText =
              message.role === "assistant" && hasFitToolOutput(message);
            const partsToRender = suppressAssistantText
              ? message.parts.filter((part) => part.type !== "text")
              : message.parts;

            if (partsToRender.length === 0) {
              return null;
            }

            return (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-[#FF5C28] text-black"
                      : "border border-zinc-800 bg-zinc-900 text-zinc-100"
                  }`}
                >
                  {!suppressAssistantText && (
                    <div
                      className={`mb-1 text-xs font-medium uppercase tracking-wide ${
                        message.role === "user"
                          ? "text-black/60"
                          : "text-[#FF5C28]"
                      }`}
                    >
                      {message.role}
                    </div>
                  )}
                  {partsToRender.map((part, index) => (
                    <MessagePart
                      key={`${message.id}-${index}`}
                      part={part}
                      messageId={message.id}
                      index={index}
                      roomImageUrl={latestImageByMessageId.get(message.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {isBusy && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#FF5C28]" />
              Running fit logic…
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {error.message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {imageFile && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>
                Image:{" "}
                <span className="text-[#FF5C28]">{imageFile.name}</span>
              </span>
              <button
                type="button"
                className="text-[#FF5C28] hover:text-[#ff7347] hover:underline"
                onClick={() => {
                  setImageFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setImageFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-[#FF5C28] hover:text-[#FF5C28]"
              title="Attach image for multimodal reasoning"
            >
              Image
            </button>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask FitCheck what product fits your uploaded room photo…"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#FF5C28] focus:ring-2 focus:ring-[#FF5C28]/30"
              disabled={isBusy}
            />
            {isBusy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-[#FF5C28]"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !imageFile}
                className="rounded-xl bg-[#FF5C28] px-4 py-2 text-sm font-medium text-black hover:bg-[#ff7347] disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
