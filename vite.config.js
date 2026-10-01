import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  publicDir: "public",
  optimizeDeps: {
    include: ["turbowarp-packager", "turbowarp-unpackager"],
    exclude: ["@ffmpeg/ffmpeg", "@sqlite.org/sqlite-wasm", "@bokuweb/zstd-wasm", "@yowasp/clang"],
  },
  base: "/convert/",
  worker: {
    format: "es",
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "turbowarp-packager": fileURLToPath(
        new URL("./built/turbowarp-packager/packager.js", import.meta.url),
      ),
      "turbowarp-unpackager": fileURLToPath(
        new URL("./built/turbowarp-unpackager/unpackager.js", import.meta.url),
      ),
      built: fileURLToPath(new URL("./built", import.meta.url)),
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "built/espeakng.js/js/espeakng.worker.js",
          dest: "js",
        },
        {
          src: "built/espeakng.js/js/espeakng.worker.data",
          dest: "js",
        },
        {
          src: "node_modules/pdfjs-dist/{standard_fonts,cmaps,wasm}",
          dest: "js/pdfjs",
        },
        {
          src: "built/typst-assets/files/fonts/*",
          dest: "wasm/typst",
        },
      ],
    }),
    preact({
      prefreshEnabled: false,
      reactAliasesEnabled: true,
    }),
  ],
});
