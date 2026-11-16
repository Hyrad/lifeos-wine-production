import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const sourceFile = (name: string) => decodeURIComponent(new URL(name, import.meta.url).pathname);
export default defineConfig(({ mode }) => {
  const privateBuild = mode === "private";
  return {
    resolve: { alias: {
      "#wine-supplies": sourceFile(privateBuild ? "./src/components/PrivateWineSupplies.tsx" : "./src/components/WineSupplies.tsx"),
      "#wine-edition": sourceFile(privateBuild ? "./src/data/edition.private.ts" : "./src/data/edition.public.ts"),
    } },
    build: { outDir: privateBuild ? ".private-dist" : "dist" },
    base: "/lifeos-wine-production/",
    plugins: [
      react(),
      {
        name: "production-content-security-policy",
        // Development needs Vite's refresh preamble and WebSocket. Published
        // artifacts have only local static assets and no inline script/style.
        apply: "build",
        transformIndexHtml() {
          return [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content:
                  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
              },
              injectTo: "head-prepend",
            },
          ];
        },
      },
    ],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      restoreMocks: true,
    },
  };
});
