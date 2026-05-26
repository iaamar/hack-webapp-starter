import { promises as fs } from "node:fs";
import path from "node:path";

type CatalogStatus = "ok" | "missing" | "invalid-json" | "invalid-response";

export interface ModelCapabilitySummary {
  source: string;
  status: CatalogStatus;
  entryCount: number;
  supportsImageEditing: boolean;
  candidateModels: string[];
  note: string;
}

const IMAGE_HINTS = [
  "image",
  "vision",
  "multimodal",
  "edit",
  "inpaint",
  "generate",
  "diffusion",
];

const MODEL_NAME_KEYS = [
  "id",
  "name",
  "model",
  "slug",
  "providerModelId",
  "provider_model_id",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function collectStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry));
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap((entry) => collectStrings(entry));
  }
  const single = asString(value);
  return single ? [single] : [];
}

function extractModelName(entry: Record<string, unknown>, fallbackIndex: number): string {
  for (const key of MODEL_NAME_KEYS) {
    const value = asString(entry[key]);
    if (value) {
      return value;
    }
  }
  return `entry-${fallbackIndex + 1}`;
}

function isErrorPayloadEntry(entry: Record<string, unknown>): boolean {
  const message = asString(entry.message);
  if (!message) {
    return false;
  }

  const keys = Object.keys(entry);
  const hasOnlyErrorLikeKeys = keys.every((key) =>
    ["code", "message", "error", "detail", "stack"].includes(key),
  );

  return hasOnlyErrorLikeKeys || message.includes("Argument #") || message.includes("stack");
}

function supportsImageEditing(entry: Record<string, unknown>): boolean {
  const lowered = collectStrings(entry)
    .join(" ")
    .toLowerCase();

  return IMAGE_HINTS.some((hint) => lowered.includes(hint));
}

export async function inspectModelsCatalog(
  modelsFilePath = path.join(process.cwd(), "models.json"),
): Promise<ModelCapabilitySummary> {
  const source = path.basename(modelsFilePath);

  let raw: string;
  try {
    raw = await fs.readFile(modelsFilePath, "utf8");
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code === "ENOENT") {
      return {
        source,
        status: "missing",
        entryCount: 0,
        supportsImageEditing: false,
        candidateModels: [],
        note: `${source} is not present in this branch, so no image-edit model is available for direct generation.`,
      };
    }

    return {
      source,
      status: "invalid-response",
      entryCount: 0,
      supportsImageEditing: false,
      candidateModels: [],
      note: `Unable to read ${source}: ${errno.message ?? "unknown file error"}.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      source,
      status: "invalid-json",
      entryCount: 0,
      supportsImageEditing: false,
      candidateModels: [],
      note: `${source} is not valid JSON.`,
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      source,
      status: "invalid-response",
      entryCount: 0,
      supportsImageEditing: false,
      candidateModels: [],
      note: `${source} is JSON but not a model list array.`,
    };
  }

  if (parsed.length === 0) {
    return {
      source,
      status: "ok",
      entryCount: 0,
      supportsImageEditing: false,
      candidateModels: [],
      note: `${source} is empty, so no image-edit model is available.`,
    };
  }

  const recordEntries = parsed.filter(isRecord);
  if (recordEntries.length === 0) {
    return {
      source,
      status: "invalid-response",
      entryCount: parsed.length,
      supportsImageEditing: false,
      candidateModels: [],
      note: `${source} entries are not objects with model metadata.`,
    };
  }

  const errorEntries = recordEntries.filter((entry) => isErrorPayloadEntry(entry)).length;
  if (errorEntries === recordEntries.length) {
    return {
      source,
      status: "invalid-response",
      entryCount: parsed.length,
      supportsImageEditing: false,
      candidateModels: [],
      note: `${source} appears to contain API error payloads instead of model capability data.`,
    };
  }

  const candidates = recordEntries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => supportsImageEditing(entry))
    .map(({ entry, index }) => extractModelName(entry, index));

  const dedupedCandidates = Array.from(new Set(candidates));
  const supports = dedupedCandidates.length > 0;

  return {
    source,
    status: "ok",
    entryCount: parsed.length,
    supportsImageEditing: supports,
    candidateModels: dedupedCandidates,
    note: supports
      ? `${source} lists image-related capabilities for ${dedupedCandidates.length} model(s).`
      : `${source} has no explicit image-generation or image-editing capability markers.`,
  };
}
