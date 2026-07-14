import { notFound } from "next/navigation";
import { RoomExplorerClient } from "@/components/explore/room-explorer-client";
import { getHouse, getRoom, modelUrl } from "@/lib/estate-data";

export default async function ExploreRoomPage({
  params,
}: {
  params: Promise<{ houseId: string; roomId: string }>;
}) {
  const { houseId, roomId } = await params;
  const house = getHouse(houseId);
  const room = getRoom(houseId, roomId);
  if (!house || !room) notFound();

  return (
    <RoomExplorerClient
      modelUrl={modelUrl(room.modelFile)}
      backHref={`/houses/${house.id}/rooms/${room.id}`}
      tiltDegrees={room.tiltDegrees}
      rollDegrees={room.rollDegrees}
    />
  );
}
