import { notFound } from "next/navigation";
import { RoomExplorerClient } from "@/components/explore/room-explorer-client";
import { getHouse, getRoom, modelUrl } from "@/lib/estate-data";

export default async function ExploreHousePage({
  params,
}: {
  // Optional catch-all: /houses/X/explore (no room, spawns at the model's origin) and
  // /houses/X/explore/roomId (spawns at that room's point) are the same page.
  params: Promise<{ houseId: string; roomId?: string[] }>;
}) {
  const { houseId, roomId } = await params;
  const house = getHouse(houseId);
  if (!house) notFound();

  const requestedRoomId = roomId?.[0];
  const room = requestedRoomId ? getRoom(houseId, requestedRoomId) : undefined;
  if (requestedRoomId && !room) notFound();

  return (
    <RoomExplorerClient
      modelUrl={modelUrl(house.modelFile)}
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
