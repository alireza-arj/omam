/** @type {import('tailwindcss').Config} */
const path = require("path");

module.exports = {
  content: [
    path.join(__dirname, "app/**/*.{ts,tsx}"),
    path.join(__dirname, "src/**/*.{ts,tsx}")
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      /* Taraz — mirrors src/design/taraz/tokens.ts. Colour, type and radius
         decisions live there; these exist only so utility classes cannot
         reintroduce an off-system value. */
      colors: {
        surface: {
          app: "#F5F7FA",
          card: "#FFFFFF",
          sunken: "#EDF0F4",
          inverse: "#0B0E12"
        },
        ink: {
          title: "#0B0E12",
          body: "#262D36",
          muted: "#7C8796",
          faint: "#A3ADBA"
        },
        accent: {
          50: "#FFF1F4",
          100: "#FFE0E7",
          200: "#FFC2CF",
          300: "#FF93AC",
          400: "#FF5C82",
          500: "#FF375F",
          600: "#E31C47",
          700: "#BB1236",
          800: "#8E0E29",
          900: "#5E0A1B"
        },
        success: "#0E9F6E",
        warning: "#E8A33D",
        info: "#2F80ED",
        hairline: "rgb(21 26 33 / 0.10)"
      },
      borderRadius: {
        xs: "5px",
        sm: "8px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "24px",
        "3xl": "34px"
      },
      fontFamily: {
        display: ["Figtree_600SemiBold"],
        text: ["PublicSans_400Regular"],
        mono: ["IBMPlexMono_400Regular"]
      }
    }
  },
  plugins: []
};
