import { notFound } from "next/navigation";
import { RoomExplorerClient } from "@/components/explore/room-explorer-client";
import { getBaseUrl } from "@/lib/base-url";
import type { House } from "@/types/estate";

export default async function ExploreHousePage({
  params,
}: {
  // Optional catch-all: /houses/X/explore (no room, spawns at the model's origin) and
  // /houses/X/explore/roomId (spawns at that room's point) are the same page.
  params: Promise<{ houseId: string; roomId?: string[] }>;
}) {
  const { houseId, roomId } = await params;
  const res = await fetch(`${await getBaseUrl()}/api/houses/${houseId}`, { cache: "no-store" });
  if (res.status === 404) notFound();
  const house: House = await res.json();

  // Rooms come back embedded in the house response, so the requested room is looked up locally
  // instead of a second request.
  const requestedRoomId = roomId?.[0];
  const room = requestedRoomId ? house.rooms.find((r) => r.id === requestedRoomId) : undefined;
  if (requestedRoomId && !room) notFound();

  return (
    <RoomExplorerClient
      modelUrl={house.modelUrl}
      modelFormat={house.modelFormat}
      backHref={`/houses/${house.id}`}
      tiltDegrees={house.tiltDegrees}
      rollDegrees={house.rollDegrees}
      modelSizeBytes={house.modelSizeBytes}
      spawnPosition={room?.spawnPosition}
      spawnYaw={room?.spawnYaw}
      spawnPitch={room?.spawnPitch}
    />
  );
}
