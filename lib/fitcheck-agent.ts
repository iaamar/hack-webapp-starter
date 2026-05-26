import {
  RoomScene,
  ShoppingProduct,
  roomScenes,
  shoppingProducts,
} from "@/lib/fitcheck-data";

export type FitVerdict = "Best fit" | "Fits" | "Tight fit" | "Does not fit";

export interface ProductFitResult {
  product: ShoppingProduct;
  verdict: FitVerdict;
  score: number;
  tableClearance: number;
  heightBuffer: number;
  reasons: string[];
}

export interface VisualGenerationPlan {
  provider: "Subconscious TIM-Qwen3.6 + local 3D renderer";
  prompt: string;
  status: string;
}

export interface SurfaceDetection {
  sceneId: string;
  surfaceName: string;
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  evidence: string[];
}

export interface FitcheckResult {
  scene: RoomScene;
  query: string;
  surfaceDetection: SurfaceDetection;
  tableSafeZone: {
    width: number;
    depth: number;
    maxHeight: number;
  };
  rankedProducts: ProductFitResult[];
  visualPlan: VisualGenerationPlan;
  visualReasoning: string[];
}

const MIN_TABLE_CLEARANCE = 6;
const MAX_TABLETOP_HEIGHT = 24;

const getConfidenceLabel = (
  confidence: number,
): SurfaceDetection["confidenceLabel"] => {
  if (confidence >= 0.85) {
    return "high";
  }

  if (confidence >= 0.65) {
    return "medium";
  }

  return "low";
};

const getVerdict = (
  tableClearance: number,
  heightBuffer: number,
  score: number,
): FitVerdict => {
  if (tableClearance < 0 || heightBuffer < 0) {
    return "Does not fit";
  }

  if (score >= 90) {
    return "Best fit";
  }

  if (score >= 74) {
    return "Fits";
  }

  return "Tight fit";
};

export const rankProductsForScene = (
  scene: RoomScene,
  query: string,
): FitcheckResult => {
  const tableSafeZone = {
    width: scene.surfaceDimensions.width - MIN_TABLE_CLEARANCE * 2,
    depth: scene.surfaceDimensions.depth - MIN_TABLE_CLEARANCE * 2,
    maxHeight: MAX_TABLETOP_HEIGHT,
  };

  const rankedProducts = shoppingProducts
    .map((product): ProductFitResult => {
      const widthClearance = tableSafeZone.width - product.dimensions.width;
      const depthClearance = tableSafeZone.depth - product.dimensions.depth;
      const tableClearance = Math.min(widthClearance, depthClearance);
      const heightBuffer = tableSafeZone.maxHeight - product.dimensions.height;
      const score = Math.max(
        0,
        Math.min(100, 86 + tableClearance * 1.4 + heightBuffer * 1.2),
      );

      const reasons = [
        `${product.dimensions.width}" x ${product.dimensions.depth}" footprint on a ${scene.surfaceDimensions.width}" ${scene.surfaceName}.`,
        `${Math.max(0, tableClearance).toFixed(0)}" tabletop clearance after the safety margin.`,
        heightBuffer >= 0
          ? `${heightBuffer}" below the TV sightline limit.`
          : `${Math.abs(heightBuffer)}" taller than the TV sightline limit.`,
        ...product.evidence,
      ];

      return {
        product,
        verdict: getVerdict(tableClearance, heightBuffer, score),
        score: Math.round(score),
        tableClearance,
        heightBuffer,
        reasons,
      };
    })
    .sort((left, right) => right.score - left.score);

  const surfaceDetection: SurfaceDetection = {
    sceneId: scene.id,
    surfaceName: scene.surfaceName,
    confidence: scene.detection.confidence,
    confidenceLabel: getConfidenceLabel(scene.detection.confidence),
    evidence: scene.detection.evidence,
  };

  const bestMatch = rankedProducts[0];
  const visualReasoning = [
    `${scene.surfaceName} detected at ${(surfaceDetection.confidence * 100).toFixed(0)}% confidence using the uploaded room context.`,
    `${bestMatch?.product.name ?? "Top recommendation"} leaves ${Math.max(0, bestMatch?.tableClearance ?? 0).toFixed(0)} inches of tabletop clearance in the safe zone.`,
    `${Math.max(0, bestMatch?.heightBuffer ?? 0)} inches of height buffer keeps the recommendation under the sightline limit.`,
  ];

  return {
    scene,
    query,
    surfaceDetection,
    tableSafeZone,
    rankedProducts,
    visualPlan: {
      provider: "Subconscious TIM-Qwen3.6 + local 3D renderer",
      prompt: [
        "Analyze the user-provided room image and generate a 3D room-fit visualization.",
        `User request: ${query}`,
        `Detected surface: ${scene.surfaceName}, ${scene.surfaceDimensions.width}" wide by ${scene.surfaceDimensions.depth}" deep.`,
        `Safe tabletop zone: ${tableSafeZone.width}" by ${tableSafeZone.depth}", max object height ${tableSafeZone.maxHeight}".`,
        `Recommended product: ${rankedProducts[0]?.product.name}.`,
        "Show the product footprint, remaining clearance, and sightline risk.",
      ].join(" "),
      status:
        "Subconscious handles visual reasoning from the uploaded image; the chat UI renders a local composite best-fit preview so the flow works without an image-generation endpoint.",
    },
    visualReasoning,
  };
};

export const defaultFitcheckResult = rankProductsForScene(
  roomScenes[0],
  roomScenes[0].userPrompt,
);
