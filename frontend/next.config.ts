import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
  ...(isGithubPages && {
    scope: "/chef/",
    sw: "sw.js",
  }),
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@shared/cortex"],
  env: {
    NEXT_PUBLIC_BASE_PATH: isGithubPages ? "/chef" : "",
  },
  ...(isGithubPages && {
    output: "export",
    basePath: "/chef",
    assetPrefix: "/chef/",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default withPWA(nextConfig);
