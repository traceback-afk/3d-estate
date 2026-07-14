// Prisma query + row-to-type mapping logic. Imported only by app/api/houses/** route handlers -
// pages fetch those routes instead of calling this directly (see lib/base-url.ts).
import { prisma } from "./db";
import type { House, Room } from "@/types/estate";

function toRoom(room: {
  id: string;
  name: string;
  description: string;
  spawnX: number | null;
  spawnY: number | null;
  spawnZ: number | null;
  spawnYaw: number | null;
  spawnPitch: number | null;
}): Room {
  const hasSpawnPosition = room.spawnX !== null && room.spawnY !== null && room.spawnZ !== null;
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    spawnPosition: hasSpawnPosition
      ? { x: room.spawnX!, y: room.spawnY!, z: room.spawnZ! }
      : undefined,
    spawnYaw: room.spawnYaw ?? undefined,
    spawnPitch: room.spawnPitch ?? undefined,
  };
}

function toHouse(house: {
  id: string;
  name: string;
  address: string;
  description: string;
  modelUrl: string;
  modelFormat: string;
  modelSizeBytes: number | null;
  tiltDegrees: number;
  rollDegrees: number;
  rooms: Parameters<typeof toRoom>[0][];
}): House {
  return {
    id: house.id,
    name: house.name,
    address: house.address,
    description: house.description,
    modelUrl: house.modelUrl,
    // Stored as a plain string column (no DB-level enum) so admin-panel uploads can't be
    // rejected by a schema mismatch if a new format is ever added - validated at the edges
    // (upload route, room-explorer) instead.
    modelFormat: house.modelFormat === "sog" ? "sog" : "ply",
    modelSizeBytes: house.modelSizeBytes ?? undefined,
    tiltDegrees: house.tiltDegrees,
    rollDegrees: house.rollDegrees,
    rooms: house.rooms.map(toRoom),
  };
}

export async function listHouses(): Promise<House[]> {
  const houses = await prisma.house.findMany({
    include: { rooms: true },
    orderBy: { createdAt: "desc" },
  });
  return houses.map(toHouse);
}

export async function findHouse(houseId: string): Promise<House | undefined> {
  const house = await prisma.house.findUnique({
    where: { id: houseId },
    include: { rooms: true },
  });
  return house ? toHouse(house) : undefined;
}

export interface CreateHouseInput {
  name: string;
  address: string;
  description: string;
  modelUrl: string;
  modelFormat: "ply" | "sog";
  modelSizeBytes?: number;
  tiltDegrees?: number;
  rollDegrees?: number;
}

export async function createHouse(input: CreateHouseInput): Promise<House> {
  const house = await prisma.house.create({
    data: { ...input, rooms: undefined },
    include: { rooms: true },
  });
  return toHouse(house);
}

export interface UpdateHouseInput {
  name?: string;
  address?: string;
  description?: string;
  tiltDegrees?: number;
  rollDegrees?: number;
  /** Replaces the model file - see /admin/houses/[id]'s "Replace model" section. */
  modelUrl?: string;
  modelFormat?: "ply" | "sog";
  modelSizeBytes?: number;
}

export async function updateHouse(
  houseId: string,
  input: UpdateHouseInput
): Promise<House | undefined> {
  const house = await prisma.house
    .update({ where: { id: houseId }, data: input, include: { rooms: true } })
    .catch(() => null);
  return house ? toHouse(house) : undefined;
}

export async function deleteHouse(houseId: string): Promise<boolean> {
  return prisma.house
    .delete({ where: { id: houseId } })
    .then(() => true)
    .catch(() => false);
}

export interface CreateRoomInput {
  name: string;
  description: string;
  spawnX?: number;
  spawnY?: number;
  spawnZ?: number;
  spawnYaw?: number;
  spawnPitch?: number;
}

export async function createRoom(
  houseId: string,
  input: CreateRoomInput
): Promise<Room | undefined> {
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) return undefined;
  const room = await prisma.room.create({ data: { ...input, houseId } });
  return toRoom(room);
}

export type UpdateRoomInput = CreateRoomInput;

export async function updateRoom(
  houseId: string,
  roomId: string,
  input: Partial<UpdateRoomInput>
): Promise<Room | undefined> {
  const existing = await prisma.room.findFirst({ where: { id: roomId, houseId } });
  if (!existing) return undefined;
  const room = await prisma.room.update({ where: { id: roomId }, data: input });
  return toRoom(room);
}

export async function deleteRoom(houseId: string, roomId: string): Promise<boolean> {
  const existing = await prisma.room.findFirst({ where: { id: roomId, houseId } });
  if (!existing) return false;
  await prisma.room.delete({ where: { id: roomId } });
  return true;
}
