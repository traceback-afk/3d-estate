import { NextResponse } from "next/server";
import { createHouse, listHouses } from "@/lib/queries";

export async function GET() {
  const houses = await listHouses();
  return NextResponse.json(houses);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { name, address, description, modelUrl, modelFormat, modelSizeBytes, tiltDegrees, rollDegrees } = body;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof address !== "string" ||
    !address.trim() ||
    typeof description !== "string" ||
    typeof modelUrl !== "string" ||
    !modelUrl.trim() ||
    (modelFormat !== "ply" && modelFormat !== "sog")
  ) {
    return NextResponse.json(
      { error: "name, address, description, modelUrl, and modelFormat ('ply'|'sog') are required" },
      { status: 400 }
    );
  }

  const house = await createHouse({
    name,
    address,
    description,
    modelUrl,
    modelFormat,
    modelSizeBytes: typeof modelSizeBytes === "number" ? modelSizeBytes : undefined,
    tiltDegrees: typeof tiltDegrees === "number" ? tiltDegrees : undefined,
    rollDegrees: typeof rollDegrees === "number" ? rollDegrees : undefined,
  });
  return NextResponse.json(house, { status: 201 });
}
