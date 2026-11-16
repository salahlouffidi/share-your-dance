import { defineConfig } from "vite";
export default defineConfig({
  root: "src/client",
  define: { __REDDIT__: "false" },
  server: { port: 5173, strictPort: true },
  build: { outDir: "../../dist-local", emptyOutDir: true },
});
