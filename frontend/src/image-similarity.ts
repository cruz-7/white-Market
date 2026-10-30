export interface ImageSignature {
  colorHistogram: number[];
  differenceHash: string;
}

export async function createImageSignature(blob: Blob): Promise<ImageSignature> {
  const bitmap = await createImageBitmap(blob);
  try {
    const histogramCanvas = document.createElement("canvas");
    histogramCanvas.width = 32;
    histogramCanvas.height = 32;
    const histogramContext = histogramCanvas.getContext("2d", { willReadFrequently: true });
    if (!histogramContext) throw new Error("Image analysis is unavailable in this browser.");
    histogramContext.drawImage(bitmap, 0, 0, 32, 32);
    const pixels = histogramContext.getImageData(0, 0, 32, 32).data;
    const colorHistogram = Array.from({ length: 48 }, () => 0);

    for (let index = 0; index < pixels.length; index += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        const bin = Math.min(15, Math.floor(pixels[index + channel] / 16));
        colorHistogram[channel * 16 + bin] += 1;
      }
    }
    for (let index = 0; index < colorHistogram.length; index += 1) {
      colorHistogram[index] /= 32 * 32;
    }

    const hashCanvas = document.createElement("canvas");
    hashCanvas.width = 9;
    hashCanvas.height = 8;
    const hashContext = hashCanvas.getContext("2d", { willReadFrequently: true });
    if (!hashContext) throw new Error("Image analysis is unavailable in this browser.");
    hashContext.drawImage(bitmap, 0, 0, 9, 8);
    const gray = hashContext.getImageData(0, 0, 9, 8).data;
    const bits: string[] = [];
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const left = (y * 9 + x) * 4;
        const right = left + 4;
        const leftGray = gray[left] * 0.299 + gray[left + 1] * 0.587 + gray[left + 2] * 0.114;
        const rightGray = gray[right] * 0.299 + gray[right + 1] * 0.587 + gray[right + 2] * 0.114;
        bits.push(leftGray > rightGray ? "1" : "0");
      }
    }
    return { colorHistogram, differenceHash: bits.join("") };
  } finally {
    bitmap.close();
  }
}

export function compareImageSignatures(left: ImageSignature, right: ImageSignature): number {
  const histogramSimilarity =
    left.colorHistogram.reduce(
      (total, value, index) => total + Math.min(value, right.colorHistogram[index]),
      0
    ) / 3;
  let differentBits = 0;
  for (let index = 0; index < left.differenceHash.length; index += 1) {
    if (left.differenceHash[index] !== right.differenceHash[index]) differentBits += 1;
  }
  const structureSimilarity = 1 - differentBits / left.differenceHash.length;
  return Math.round((histogramSimilarity * 0.65 + structureSimilarity * 0.35) * 1000) / 1000;
}
