// Section 9: Dependencies — Lovable build tooling replaced with standard plugins.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  ssr: {
    // Bundle these into dist/server/ so the Vercel function is self-contained.
    noExternal: ["@anthropic-ai/sdk", "stripe", "@supabase/supabase-js", "zod"],
  },
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    react(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
  ],
});
