import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          // Stripe — only loaded when user opens checkout
          if (id.includes("@stripe")) return "stripe";
          // Tiptap editor — only used in /manus/:id
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "editor";
          // Radix UI primitives
          if (id.includes("@radix-ui")) return "radix";
          // React core
          if (id.includes("react-dom") || id.includes("scheduler") || id.includes("react/")) {
            return "react";
          }
          // Supabase client
          if (id.includes("@supabase")) return "supabase";
          // Form / validation
          if (id.includes("react-hook-form") || id.includes("zod") || id.includes("@hookform")) {
            return "forms";
          }
          // Misc charting / heavy libs
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          return undefined;
        },
      },
    },
  },
}));
