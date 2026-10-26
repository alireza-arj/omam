import Svg, { Circle, Path, Rect } from "react-native-svg";
import { layout, palette, radius } from "../design/taraz";

/** The app icon, drawn inline: a crimson dial with two hands on ink. */
export function BrandMark({ size = layout.controlField, backgroundColor = palette.gray950 }: { size?: number; backgroundColor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden>
      <Rect width={1024} height={1024} rx={(radius.lg / size) * 1024} fill={backgroundColor} />
      <Circle cx={512} cy={512} r={276} stroke={palette.accent600} strokeWidth={72} fill="none" />
      <Path d="M512 512V350M512 512L650 590" stroke={palette.gray50} strokeWidth={68} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={512} cy={512} r={38} fill={palette.accent600} />
    </Svg>
  );
}
