import { defineConfig } from "vite";
import { devvit } from "@devvit/start/vite";
export default defineConfig({
  define: { __REDDIT__: "true" },
  plugins: [devvit({ client: { define: { __REDDIT__: "true" } } })],
});
