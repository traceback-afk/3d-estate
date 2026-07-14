// One-time migration of the pre-Prisma sample-house2 entry (formerly hardcoded in
// lib/estate-data.ts) into the database, pointing at its already-uploaded blob so nothing needs
// to be re-uploaded. Run via `pnpm db:seed`.
import { createHash } from "node:crypto";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Mirrors the (now-removed) blobPathname()/modelUrl() helpers that used to live in
// lib/estate-data.ts - kept here only because this script runs once against the blob that was
// uploaded under that scheme before the admin panel/Prisma migration existed.
function blobPathname(modelFile: string, salt: string): string {
  const ext = modelFile.slice(modelFile.lastIndexOf("."));
  const hash = createHash("sha256").update(`${salt}:${modelFile}`).digest("hex").slice(0, 32);
  return `${hash}${ext}`;
}

function legacyModelUrl(modelFile: string): string {
  const blobBaseUrl = process.env.BLOB_BASE_URL;
  const salt = process.env.BLOB_PATHNAME_SALT;
  if (!blobBaseUrl || !salt) {
    throw new Error("BLOB_BASE_URL and BLOB_PATHNAME_SALT must be set to seed the existing house");
  }
  return `${blobBaseUrl.replace(/\/$/, "")}/${blobPathname(modelFile, salt)}`;
}

async function main() {
  const house = await prisma.house.upsert({
    where: { id: "seed-sample-house2" },
    update: {},
    create: {
      id: "seed-sample-house2",
      name: "Sample House2",
      address: "123 Demo Street",
      description:
        "A demo property with a 3D-scanned house walkthrough (gaussian splat). Add more houses via /admin.",
      modelUrl: legacyModelUrl("gs_Cap2.ply"),
      modelFormat: "ply",
      modelSizeBytes: 267026605,
      tiltDegrees: 180,
      rooms: {
        create: [
          {
            name: "Living Room",
            description: "Main living area.",
          },
        ],
      },
    },
  });

  console.log(`Seeded house ${house.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
