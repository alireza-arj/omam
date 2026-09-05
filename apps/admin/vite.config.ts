import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const packages = fileURLToPath(new URL("../../packages", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@omam/contracts": `${packages}/contracts/src/index.ts`,
      "@omam/calendar": `${packages}/calendar/src/index.ts`,
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
