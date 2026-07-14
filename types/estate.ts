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
  /** Full Vercel Blob URL for the model file, resolved at upload time - see /admin. */
  modelUrl: string;
  /** "ply" or "sog" - selects which loading path components/explore/room-explorer.tsx uses. */
  modelFormat: "ply" | "sog";
  /**
   * Size of the model file in bytes. Vercel Blob serves large models dynamically
   * Brotli-compressed with no Content-Length header, so the browser has no way to learn the real
   * size on its own - without this, download progress can't be computed at all.
   */
  modelSizeBytes?: number;
  /**
   * Rotation around the X axis on load, in degrees. Scanning/training tools don't all agree on
   * which axis is "up", so a house can load tilted or upside-down - nudge this value (try 90,
   * -90, or 180) until it looks right. Defaults to 0 (no correction).
   */
  tiltDegrees?: number;
  /**
   * Rotation around the Z axis on load, in degrees - corrects residual roll that tiltDegrees
   * alone can't fix (the capture wasn't level, so straight walls appear to bank as the camera
   * turns). Nudge in small steps (e.g. 1-5) until vertical edges stay upright while panning
   * left/right. Defaults to 0 (no correction).
   */
  rollDegrees?: number;
  rooms: Room[];
}
