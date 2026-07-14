import { NextResponse } from "next/server";
import { createRoom } from "@/lib/queries";

export async function POST(
  request: Request,
  context: { params: Promise<{ houseId: string }> }
) {
  const { houseId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { name, description, spawnX, spawnY, spawnZ, spawnYaw, spawnPitch } = body;
  if (typeof name !== "string" || !name.trim() || typeof description !== "string") {
    return NextResponse.json({ error: "name and description are required" }, { status: 400 });
  }

  const room = await createRoom(houseId, {
    name,
    description,
    spawnX: typeof spawnX === "number" ? spawnX : undefined,
    spawnY: typeof spawnY === "number" ? spawnY : undefined,
    spawnZ: typeof spawnZ === "number" ? spawnZ : undefined,
    spawnYaw: typeof spawnYaw === "number" ? spawnYaw : undefined,
    spawnPitch: typeof spawnPitch === "number" ? spawnPitch : undefined,
  });
  if (!room) return NextResponse.json({ error: "House not found" }, { status: 404 });
  return NextResponse.json(room, { status: 201 });
}
