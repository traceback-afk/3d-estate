import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next defaults this to true for the App Router, which makes React mount every component
  // twice in dev (mount -> cleanup -> mount) to catch effects with broken cleanup. RoomExplorer's
  // effect does real, expensive imperative setup (WebGL context, a potentially 100s-of-MB asset
  // fetch) that PlayCanvas has no way to cancel once started - Asset.unload() clears the local
  // cache but never aborts the in-flight request - so the double-invoke causes two full, real,
  // parallel downloads of the same model in dev. Doesn't affect production: Strict Mode's
  // double-invoke is a dev-only diagnostic, stripped from production builds entirely.
  reactStrictMode: false,
};

export default nextConfig;
