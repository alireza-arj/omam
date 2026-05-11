import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

type OmamLogoProps = {
  size?: number;
};

export function OmamLogo({ size = 92 }: OmamLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <Defs>
        <LinearGradient id="omamRing" x1="32.4" y1="25.4" x2="98.2" y2="103.8" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#69F3C6" />
          <Stop offset="0.54" stopColor="#2F6153" />
          <Stop offset="1" stopColor="#1E6F4D" />
        </LinearGradient>
        <LinearGradient id="omamPath" x1="41.2" y1="73.8" x2="89" y2="49" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F8FBF7" />
          <Stop offset="1" stopColor="#CDEBDD" />
        </LinearGradient>
      </Defs>

      <Rect x="11" y="11" width="106" height="106" rx="27" fill="#08111F" />
      <G>
        <Circle
          cx="64"
          cy="64"
          r="40.25"
          stroke="url(#omamRing)"
          strokeWidth="13.5"
          strokeLinecap="round"
          strokeDasharray="208.75 45"
          transform="rotate(-86 64 64)"
        />
        <Path
          d="M41.25 71.25L53.1 58.75L64 71L78.1 50.5L88.5 64"
          stroke="url(#omamPath)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="89" cy="42.1" r="7" fill="#69F3C6" />
        <Circle cx="64" cy="71" r="4.25" fill="#FFC671" />
      </G>
    </Svg>
  );
}
