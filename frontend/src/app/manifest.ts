import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.GITHUB_PAGES === "true" ? "/chef" : "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chef — Kitchen Decisions",
    short_name: "Chef",
    description: "Cook vs order vs eat out — with honest tradeoffs",
    start_url: base + "/",
    display: "standalone",
    background_color: "#0f0e0c",
    theme_color: "#1c1a17",
    orientation: "portrait-primary",
    icons: [
      {
        src: base + "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: base + "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: base + "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
