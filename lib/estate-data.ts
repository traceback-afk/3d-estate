import { createHash } from "node:crypto";

export interface Room {
  id: string;
  name: string;
  description: string;
  /**
   * Where the camera starts when exploring this room, in the house model's local units (after
   * House.tiltDegrees/rollDegrees correction, relative to the model's own recentered origin).
   * While exploring, press "P" to print your current position/look direction to the console in a
   * ready-to-paste form. Defaults to the model's origin.
   */
  spawnPosition?: { x: number; y: number; z: number };
  /** Camera yaw at spawn, in degrees. Defaults to 0. See spawnPosition. */
  spawnYaw?: number;
  /** Camera pitch at spawn, in degrees. Defaults to 0. See spawnPosition. */
  spawnPitch?: number;
}

export interface House {
  id: string;
  name: string;
  address: string;
  description: string;
  /**
   * filename of the .ply point cloud / gaussian splat inside the /3dmodels directory. A house is
   * captured as a single walkthrough scan shared by all of its rooms - individual rooms are just
   * named spawn points within it (see Room.spawnPosition), not separate files.
   */
  modelFile: string;
  /**
   * Rotates the model around the X axis on load, in degrees. Scanning/training tools don't all
   * agree on which axis is "up", so a house can load tilted or upside-down - nudge this value
   * (try 90, -90, or 180) until it looks right. Defaults to 0 (no correction).
   */
  tiltDegrees?: number;
  /**
   * Rotates the model around the Z axis on load, in degrees - corrects residual roll that
   * tiltDegrees alone can't fix (the capture wasn't level, so straight walls appear to bank as
   * the camera turns). Nudge in small steps (e.g. 1-5) until vertical edges stay upright while
   * panning left/right. Defaults to 0 (no correction).
   */
  rollDegrees?: number;
  /**
   * Size of modelFile in bytes, printed by `pnpm upload-models`. Vercel Blob serves large models
   * dynamically Brotli-compressed with no Content-Length header, so the browser has no way to
   * learn the real size on its own - without this, download progress can't be computed at all.
   */
  modelSizeBytes?: number;
  rooms: Room[];
}

export const houses: House[] = [
  // {
  //   id: "sample-house",
  //   name: "Sample House",
  //   address: "123 Demo Street",
  //   description:
  //     "A demo property with a 3D-scanned house walkthrough (point cloud, captured with Polycam). Add more houses in lib/estate-data.ts as new scans are added to /3dmodels.",
  //   modelFile: "13_07_2026.ply",
  //   tiltDegrees: -90,
  //   rooms: [
  //     {
  //       id: "scanned-room",
  //       name: "Entrance",
  //       description: "Where the walkthrough starts.",
  //     },
  //   ],
  // },
  {
    id: "sample-house2",
    name: "Sample House2",
    address: "123 Demo Street",
    description:
      "A demo property with a 3D-scanned house walkthrough (gaussian splat). Add more houses in lib/estate-data.ts as new scans are added to /3dmodels.",
    modelFile: "gs_Cap2.ply",
    modelSizeBytes: 267026605,
    tiltDegrees: 180,
    rooms: [
      {
        id: "scanned-room2",
        name: "Living Room",
        description: "Main living area.",
      },
    ],
  },
];

export function getHouse(houseId: string): House | undefined {
  return houses.find((h) => h.id === houseId);
}

export function getRoom(houseId: string, roomId: string): Room | undefined {
  return getHouse(houseId)?.rooms.find((r) => r.id === roomId);
}

// Deterministic (same input -> same output) so re-running the upload script updates the same
// blob instead of leaving old ones behind, but unrecoverable without the salt - so the Blob URL
// doesn't reveal the original filename to a competitor scraping the site. Keep this in sync with
// the identical function in scripts/upload-models.mjs.
function blobPathname(modelFile: string, salt: string): string {
  const ext = modelFile.slice(modelFile.lastIndexOf("."));
  const hash = createHash("sha256")
    .update(`${salt}:${modelFile}`)
    .digest("hex")
    .slice(0, 32);
  return `${hash}${ext}`;
}

export function modelUrl(modelFile: string): string {
  // Once models are uploaded via `pnpm upload-models` (see scripts/upload-models.mjs), set
  // BLOB_BASE_URL and BLOB_PATHNAME_SALT to serve them straight from Vercel Blob's CDN instead of
  // proxying the file through a Next.js route. Falls back to the local /3dmodels directory for
  // dev without them.
  const blobBaseUrl = process.env.BLOB_BASE_URL;
  const salt = process.env.BLOB_PATHNAME_SALT;
  if (blobBaseUrl && salt) {
    return `${blobBaseUrl.replace(/\/$/, "")}/${blobPathname(modelFile, salt)}`;
  }
  return `/api/models/${encodeURIComponent(modelFile)}`;
}
