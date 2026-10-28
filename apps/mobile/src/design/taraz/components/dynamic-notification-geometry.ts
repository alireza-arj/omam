// Adapted from rit3zh/expo-dynamic-notifications. See ../licenses/expo-dynamic-notifications.md.
import { notificationTokens as tokens } from "../tokens";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (progress: number, start: number, end: number) => start + (end - start) * progress;

export function notificationGeometry(progress: number, width: number, height: number) {
  const drop = clamp(progress / 0.8);
  const expand = clamp((progress - 0.2) / 0.8);
  const grow = 1 - Math.pow(1 - clamp(drop / tokens.growSpan), tokens.growPower);
  const t = clamp(drop / tokens.neckBreak);
  const peak = tokens.neckRise / (tokens.neckRise + tokens.neckFall);
  const normal = Math.pow(peak, tokens.neckRise) * Math.pow(1 - peak, tokens.neckFall);
  const neck = Math.pow(t, tokens.neckRise) * Math.pow(1 - t, tokens.neckFall) / normal;
  const stretch = 1 + tokens.stretch * neck;
  const droplet = tokens.dropSize * grow;
  const dropWidth = mix(expand, droplet / stretch, width);
  const dropHeight = mix(expand, droplet * stretch, height);
  const centerY = mix(drop, tokens.islandHeight * 0.66, tokens.islandHeight + tokens.cardGap + height / 2);
  const neckWidth = Math.min(tokens.neckWidth, dropWidth) * neck;

  return {
    x: (width - dropWidth) / 2,
    y: centerY - dropHeight / 2,
    width: dropWidth,
    height: dropHeight,
    radius: Math.min(dropWidth, dropHeight) / 2,
    neckX: (width - neckWidth) / 2,
    neckY: tokens.islandHeight / 2,
    neckWidth,
    neckHeight: Math.max(centerY - tokens.islandHeight / 2, 0),
    offsetY: centerY - (tokens.islandHeight + tokens.cardGap + height / 2),
    reveal: clamp((progress - 0.55) / 0.45),
  };
}
