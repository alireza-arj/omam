/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./apps/mobile/app/**/*.{ts,tsx}", "./apps/mobile/src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        night: "#08111f",
        ink: "#10203b",
        panel: "#112340",
        line: "#274163",
        mist: "#d9e8ff",
        muted: "#8ca5c6",
        mint: "#69f3c6",
        coral: "#ff8e7a",
        sun: "#ffc671",
        sky: "#7dd3fc"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(14, 28, 52, 0.45)"
      },
      borderRadius: {
        "4xl": "32px"
      }
    }
  },
  plugins: []
};
