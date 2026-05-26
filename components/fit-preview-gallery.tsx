"use client";

import { useEffect, useState } from "react";

interface FitDimensions {
  width: number;
  depth: number;
  height: number;
}

interface BestFitProduct {
  id: string;
  name: string;
  fitConfidence: number;
  dimensions: FitDimensions;
}

interface FitPreviewGalleryProps {
  roomImageUrl: string;
  surfaceName: string;
  surfaceDimensions: FitDimensions;
  surfaceConfidence: number;
  confidenceLabel: string;
  bestFit: BestFitProduct;
  previewMode: string;
}

interface PreviewImage {
  dataUrl: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const effectiveRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + effectiveRadius, y);
  context.lineTo(x + width - effectiveRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + effectiveRadius);
  context.lineTo(x + width, y + height - effectiveRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - effectiveRadius,
    y + height,
  );
  context.lineTo(x + effectiveRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - effectiveRadius);
  context.lineTo(x, y + effectiveRadius);
  context.quadraticCurveTo(x, y, x + effectiveRadius, y);
  context.closePath();
}

function drawTag(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options?: {
    fontSize?: number;
    background?: string;
    color?: string;
  },
) {
  const fontSize = options?.fontSize ?? 16;
  const textColor = options?.color ?? "#F8FAFC";
  const background = options?.background ?? "rgba(17, 24, 39, 0.86)";
  const paddingX = 12;
  const paddingY = 8;

  context.save();
  context.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
  const tagWidth = context.measureText(text).width + paddingX * 2;
  const tagHeight = fontSize + paddingY * 2;

  drawRoundedRect(context, x, y, tagWidth, tagHeight, 10);
  context.fillStyle = background;
  context.fill();

  context.fillStyle = textColor;
  context.textBaseline = "top";
  context.fillText(text, x + paddingX, y + paddingY);
  context.restore();
}

function trimText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let end = value.length;
  while (end > 0) {
    const candidate = `${value.slice(0, end)}...`;
    if (context.measureText(candidate).width <= maxWidth) {
      return candidate;
    }
    end -= 1;
  }
  return "...";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load room image"));
    image.src = url;
  });
}

function inferSurfaceArea(imageWidth: number, imageHeight: number) {
  const widthPx = clamp(imageWidth * 0.56, imageWidth * 0.34, imageWidth * 0.78);
  const depthPx = clamp(imageHeight * 0.23, imageHeight * 0.15, imageHeight * 0.38);
  return {
    centerX: imageWidth * 0.5,
    centerY: imageHeight * 0.64,
    widthPx,
    depthPx,
  };
}

function createCompositePreview({
  sourceImage,
  bestFit,
  surfaceName,
  surfaceDimensions,
  surfaceConfidence,
  confidenceLabel,
  previewMode,
}: {
  sourceImage: HTMLImageElement;
  bestFit: BestFitProduct;
  surfaceName: string;
  surfaceDimensions: FitDimensions;
  surfaceConfidence: number;
  confidenceLabel: string;
  previewMode: string;
}): PreviewImage {
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.naturalWidth || sourceImage.width;
  canvas.height = sourceImage.naturalHeight || sourceImage.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

  const darken = context.createLinearGradient(0, 0, 0, canvas.height);
  darken.addColorStop(0, "rgba(0, 0, 0, 0.08)");
  darken.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  context.fillStyle = darken;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const surfaceArea = inferSurfaceArea(canvas.width, canvas.height);

  context.save();
  context.setLineDash([12, 10]);
  context.strokeStyle = "rgba(254, 242, 208, 0.9)";
  context.lineWidth = clamp(canvas.width * 0.0032, 2, 6);
  context.beginPath();
  context.ellipse(
    surfaceArea.centerX,
    surfaceArea.centerY,
    surfaceArea.widthPx / 2,
    surfaceArea.depthPx / 2,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();

  const widthRatio = clamp(
    bestFit.dimensions.width / Math.max(surfaceDimensions.width, 1),
    0.14,
    0.92,
  );
  const depthRatio = clamp(
    bestFit.dimensions.depth / Math.max(surfaceDimensions.depth, 1),
    0.14,
    0.92,
  );

  const productWidthPx = surfaceArea.widthPx * widthRatio;
  const productDepthPx = surfaceArea.depthPx * depthRatio;
  const productCenterX = surfaceArea.centerX;
  const productCenterY = surfaceArea.centerY;

  context.fillStyle = "rgba(0, 0, 0, 0.35)";
  context.beginPath();
  context.ellipse(
    productCenterX,
    productCenterY + productDepthPx * 0.18,
    Math.max(16, productWidthPx * 0.52),
    Math.max(10, productDepthPx * 0.36),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  const footprintGradient = context.createRadialGradient(
    productCenterX,
    productCenterY - productDepthPx * 0.08,
    Math.max(4, productWidthPx * 0.08),
    productCenterX,
    productCenterY,
    Math.max(24, productWidthPx * 0.58),
  );
  footprintGradient.addColorStop(0, "rgba(255, 255, 255, 0.75)");
  footprintGradient.addColorStop(0.4, "#22C55E");
  footprintGradient.addColorStop(1, "rgba(17, 24, 39, 0.9)");

  context.fillStyle = footprintGradient;
  context.beginPath();
  context.ellipse(
    productCenterX,
    productCenterY,
    Math.max(12, productWidthPx * 0.5),
    Math.max(8, productDepthPx * 0.44),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  const potWidth = Math.max(16, productWidthPx * 0.5);
  const potHeight = clamp(productDepthPx * 0.75, 18, 70);
  context.fillStyle = "#B45309";
  drawRoundedRect(
    context,
    productCenterX - potWidth / 2,
    productCenterY + productDepthPx * 0.24,
    potWidth,
    potHeight,
    10,
  );
  context.fill();

  const confidenceText = `${bestFit.fitConfidence}% fit confidence`;
  drawTag(
    context,
    confidenceText,
    clamp(productCenterX - 120, 16, canvas.width - 250),
    clamp(productCenterY - productDepthPx - 30, 18, canvas.height - 54),
    {
      fontSize: 16,
      background: "rgba(255, 92, 40, 0.9)",
      color: "#111827",
    },
  );

  const surfaceText = `${surfaceName}: ${surfaceDimensions.width}x${surfaceDimensions.depth} in (${Math.round(
    surfaceConfidence * 100,
  )}% ${confidenceLabel})`;
  drawTag(context, surfaceText, 16, 16, { fontSize: 16 });

  const bottomX = 16;
  const bottomY = canvas.height - 72;
  const bottomWidth = canvas.width - 32;
  const bottomHeight = 56;
  drawRoundedRect(context, bottomX, bottomY, bottomWidth, bottomHeight, 12);
  context.fillStyle = "rgba(17, 24, 39, 0.88)";
  context.fill();

  context.font = "600 19px Inter, Arial, sans-serif";
  context.fillStyle = "#F8FAFC";
  context.textBaseline = "top";
  const modePrefix =
    previewMode === "model-capable-local-composite" ? "Best fit*" : "Best fit";
  const label = `${modePrefix} · ${bestFit.name} · ${bestFit.dimensions.width}x${bestFit.dimensions.depth}x${bestFit.dimensions.height} in`;
  context.fillText(trimText(context, label, bottomWidth - 24), bottomX + 12, bottomY + 18);

  return {
    dataUrl: canvas.toDataURL("image/png"),
  };
}

export function FitPreviewGallery({
  roomImageUrl,
  surfaceName,
  surfaceDimensions,
  surfaceConfidence,
  confidenceLabel,
  bestFit,
  previewMode,
}: FitPreviewGalleryProps) {
  const [preview, setPreview] = useState<PreviewImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function buildPreview() {
      if (!roomImageUrl) {
        setPreview(null);
        return;
      }

      setIsGenerating(true);
      try {
        const sourceImage = await loadImage(roomImageUrl);
        const generated = createCompositePreview({
          sourceImage,
          bestFit,
          surfaceName,
          surfaceDimensions,
          surfaceConfidence,
          confidenceLabel,
          previewMode,
        });
        if (!isCancelled) {
          setPreview(generated);
        }
      } catch {
        if (!isCancelled) {
          setPreview(null);
        }
      } finally {
        if (!isCancelled) {
          setIsGenerating(false);
        }
      }
    }

    void buildPreview();

    return () => {
      isCancelled = true;
    };
  }, [
    roomImageUrl,
    bestFit,
    surfaceName,
    surfaceDimensions,
    surfaceConfidence,
    confidenceLabel,
    previewMode,
  ]);

  if (isGenerating || !preview) {
    return <div className="h-56 w-full animate-pulse rounded-lg bg-zinc-900/80" />;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-700 bg-black/35">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview.dataUrl}
        alt={`Best fit preview for ${bestFit.name}`}
        className="w-full object-contain"
      />
    </section>
  );
}
