"use client";

import dynamic from "next/dynamic";

// The scene touches window/canvas/WebGL as soon as it mounts, so it's rendered client-only -
// the fallback reserves the same scroll height (3 pinned stages) to avoid a layout jump on hydration.
const Hero = dynamic(() => import("./hero-scene").then((m) => m.HeroScene), {
  ssr: false,
  loading: () => (
    <div className="relative" style={{ height: "300vh" }}>
      <div className="sticky top-0 h-dvh w-full bg-black" />
    </div>
  ),
});

export default Hero;
