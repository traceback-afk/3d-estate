import { NextResponse } from "next/server";
import { deleteRoom, updateRoom } from "@/lib/queries";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ houseId: string; roomId: string }> }
) {
  const { houseId, roomId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { name, description, spawnX, spawnY, spawnZ, spawnYaw, spawnPitch } = body;
  const room = await updateRoom(houseId, roomId, {
    name: typeof name === "string" ? name : undefined,
    description: typeof description === "string" ? description : undefined,
    spawnX: typeof spawnX === "number" ? spawnX : undefined,
    spawnY: typeof spawnY === "number" ? spawnY : undefined,
    spawnZ: typeof spawnZ === "number" ? spawnZ : undefined,
    spawnYaw: typeof spawnYaw === "number" ? spawnYaw : undefined,
    spawnPitch: typeof spawnPitch === "number" ? spawnPitch : undefined,
  });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json(room);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ houseId: string; roomId: string }> }
) {
  const { houseId, roomId } = await context.params;
  const deleted = await deleteRoom(houseId, roomId);
  if (!deleted) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
