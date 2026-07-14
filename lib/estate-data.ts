export interface Room {
  id: string;
  name: string;
  description: string;
  /** filename of the .ply point cloud / gaussian splat inside the /3dmodels directory */
  modelFile: string;
  /**
   * Rotates the model around the X axis on load, in degrees. Scanning/training tools don't all
   * agree on which axis is "up", so a room can load tilted or upside-down - nudge this value
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
}

export interface House {
  id: string;
  name: string;
  address: string;
  description: string;
  rooms: Room[];
}

export const houses: House[] = [
  // {
  //   id: "sample-house",
  //   name: "Sample House",
  //   address: "123 Demo Street",
  //   description:
  //     "A demo property with one 3D-scanned room. Add more rooms and houses in lib/estate-data.ts as new scans are added to /3dmodels.",
  //   rooms: [
  //     {
  //       id: "scanned-room",
  //       name: "Scanned Room",
  //       description: "Point cloud captured with Polycam.",
  //       modelFile: "13_07_2026.ply",
  //       tiltDegrees: -90,
  //     },
  //   ],
  // },
  {
    id: "sample-house2",
    name: "Sample House2",
    address: "123 Demo Street",
    description:
      "A demo property with one 3D-scanned room. Add more rooms and houses in lib/estate-data.ts as new scans are added to /3dmodels.",
    rooms: [
      {
        id: "scanned-room2",
        name: "Scanned Room",
        description: "Gaussian splat scan.",
        modelFile: "gs_Cap2.ply",
        tiltDegrees: 180,
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

export function modelUrl(modelFile: string): string {
  // Once models are uploaded via `pnpm upload-models` (see scripts/upload-models.mjs), set
  // BLOB_BASE_URL to serve them straight from Vercel Blob's CDN instead of proxying the file
  // through a Next.js route. Falls back to the local /3dmodels directory for dev without it.
  const blobBaseUrl = process.env.BLOB_BASE_URL;
  if (blobBaseUrl) {
    return `${blobBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(modelFile)}`;
  }
  return `/api/models/${encodeURIComponent(modelFile)}`;
}
