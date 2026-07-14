import { NextResponse } from "next/server";
import { deleteHouse, findHouse, updateHouse } from "@/lib/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ houseId: string }> }
) {
  const { houseId } = await context.params;
  const house = await findHouse(houseId);
  if (!house) return NextResponse.json({ error: "House not found" }, { status: 404 });
  return NextResponse.json(house);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ houseId: string }> }
) {
  const { houseId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const {
    name,
    address,
    description,
    tiltDegrees,
    rollDegrees,
    modelUrl,
    modelFormat,
    modelSizeBytes,
  } = body;
  const house = await updateHouse(houseId, {
    name: typeof name === "string" ? name : undefined,
    address: typeof address === "string" ? address : undefined,
    description: typeof description === "string" ? description : undefined,
    tiltDegrees: typeof tiltDegrees === "number" ? tiltDegrees : undefined,
    rollDegrees: typeof rollDegrees === "number" ? rollDegrees : undefined,
    modelUrl: typeof modelUrl === "string" ? modelUrl : undefined,
    modelFormat: modelFormat === "ply" || modelFormat === "sog" ? modelFormat : undefined,
    modelSizeBytes: typeof modelSizeBytes === "number" ? modelSizeBytes : undefined,
  });
  if (!house) return NextResponse.json({ error: "House not found" }, { status: 404 });
  return NextResponse.json(house);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ houseId: string }> }
) {
  const { houseId } = await context.params;
  const deleted = await deleteHouse(houseId);
  if (!deleted) return NextResponse.json({ error: "House not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
