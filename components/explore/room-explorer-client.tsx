"use client";

import dynamic from "next/dynamic";

// The explorer touches window/canvas/WebGL as soon as it mounts, so it's rendered
// client-only - there's nothing meaningful for the server to pre-render anyway.
export const RoomExplorerClient = dynamic(
  () => import("./room-explorer").then((m) => m.RoomExplorer),
  {
    ssr: false,
    loading: () => <div className="h-dvh w-full bg-black" />,
  }
);
