import { describe, expect, it } from "vitest";
import { compareImageSignatures, type ImageSignature } from "./image-similarity";

const signature = (histogramBin: number, differenceHash: string): ImageSignature => {
  const colorHistogram = Array.from({ length: 48 }, () => 0);
  colorHistogram[histogramBin] = 1;
  colorHistogram[16 + histogramBin % 16] = 1;
  colorHistogram[32 + histogramBin % 16] = 1;
  return { colorHistogram, differenceHash };
};

describe("local visual similarity", () => {
  it("ranks identical visual signatures as a perfect match", () => {
    const image = signature(3, "1".repeat(64));
    expect(compareImageSignatures(image, image)).toBe(1);
  });

  it("returns a lower score when color and image structure differ", () => {
    const first = signature(2, "1".repeat(64));
    const second = signature(12, "0".repeat(64));
    expect(compareImageSignatures(first, second)).toBeLessThan(0.5);
  });
});
