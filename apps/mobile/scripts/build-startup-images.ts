import { compositeImagesAsync, createSquareAsync, generateImageAsync } from "@expo/image-utils";
import { getJimpImageAsync } from "@expo/image-utils/build/jimp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startupTokens } from "../src/design/taraz/startup-tokens";

const portraitScreens = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
  [414, 896, 2], [414, 896, 3], [390, 844, 3], [428, 926, 3],
  [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3], [420, 912, 3],
  [768, 1024, 2], [810, 1080, 2], [820, 1180, 2], [834, 1112, 2],
  [834, 1194, 2], [1024, 1366, 2], [744, 1133, 2], [834, 1210, 2], [1032, 1376, 2],
] as const;

async function roundLogo(source: Buffer, size: number, radius: number) {
  const image: { bitmap: { data: Buffer }; getBufferAsync: (mime: string) => Promise<Buffer> } = await getJimpImageAsync(source);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(radius - x - 0.5, x + 0.5 - (size - radius), 0);
      const dy = Math.max(radius - y - 0.5, y + 0.5 - (size - radius), 0);
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(dx, dy)));
      image.bitmap.data[(y * size + x) * 4 + 3] = Math.round(coverage * 255);
    }
  }
  return image.getBufferAsync("image/png");
}

export async function buildStartupImages(projectRoot: string, distDir: string) {
  const outputDir = join(distDir, "assets/startup");
  const cacheDir = join(projectRoot, ".expo/pwa-startup");
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  const links: string[] = [];
  for (const [scheme, color] of [["light", startupTokens.lightBackground], ["dark", startupTokens.darkBackground]] as const) {
    const logos = new Map<number, Buffer>();
    for (const scale of [2, 3]) {
      const size = startupTokens.logoSize * scale;
      const { source } = await generateImageAsync({ projectRoot, cacheType: "pwa-startup" }, {
        src: join(projectRoot, "assets/brand/app-icon-foreground.png"),
        width: size, height: size, resizeMode: "contain",
        backgroundColor: scheme === "dark" ? startupTokens.darkLogoBackground : startupTokens.lightLogoBackground,
      });
      logos.set(scale, await roundLogo(source, size, startupTokens.logoRadius * scale));
    }
    const pixelPath = join(cacheDir, `${scheme}.png`);
    writeFileSync(pixelPath, await createSquareAsync({ size: 1, color }));
    for (const [deviceWidth, deviceHeight, scale] of portraitScreens) {
      const width = deviceWidth * scale;
      const height = deviceHeight * scale;
      const { source: background } = await generateImageAsync({ projectRoot, cacheType: "pwa-startup" }, {
        src: pixelPath, width, height, resizeMode: "cover",
      });
      const image = await compositeImagesAsync({
        foreground: logos.get(scale)!, background,
        x: (width - startupTokens.logoSize * scale) / 2,
        y: (height - startupTokens.logoSize * scale) / 2,
      });
      const name = `${scheme}-${width}x${height}.png`;
      writeFileSync(join(outputDir, name), image);
      const media = `(device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`;
      links.push(`<link rel="apple-touch-startup-image" href="/assets/startup/${name}" media="${media}" />`);
    }
  }
  return links.join("\n");
}
