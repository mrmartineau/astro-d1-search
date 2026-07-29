// @ts-check
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "static",
  adapter: cloudflare({ imageService: "compile" }),
  integrations: [mdx()],

  markdown: {
    shikiConfig: {
      defaultColor: "light-dark()",
      themes: {
        dark: "rose-pine",
        light: "rose-pine-dawn",
      },
    },
    smartypants: false,
  },
});
