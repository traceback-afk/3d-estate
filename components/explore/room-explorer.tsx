"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as pc from "playcanvas";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  MousePointerClick,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Progress, ProgressValue } from "@/components/ui/progress";
import { WordRotate } from "@/components/ui/word-rotate";
import {
  POINT_CLOUD_FRAGMENT_GLSL,
  POINT_CLOUD_VERTEX_GLSL,
} from "./point-cloud-shader";

interface RoomExplorerProps {
  modelUrl: string;
  /**
   * "ply" gets the full custom pipeline: percentile-based outlier-robust bounds, a wall/floor/
   * ceiling collision grid, and a hand-built point-cloud mesh for plain (non-splat) scans. "sog"
   * (PlayCanvas's compressed Gaussian-splat bundle format) renders natively via the engine's own
   * GSplatComponent - there's no per-point CPU data to build a collision grid from, so sog rooms
   * get recentering + speed calibration (from the resource's built-in aabb) but no collision.
   */
  modelFormat: "ply" | "sog";
  backHref: string;
  /** Rotation around the X axis applied on load, in degrees. See House.tiltDegrees. */
  tiltDegrees?: number;
  /** Rotation around the Z axis applied on load, in degrees. See House.rollDegrees. */
  rollDegrees?: number;
  /** Camera starting position within the (corrected/recentered) model. See Room.spawnPosition. */
  spawnPosition?: { x: number; y: number; z: number };
  /** Camera starting yaw in degrees. See Room.spawnYaw. */
  spawnYaw?: number;
  /** Camera starting pitch in degrees. See Room.spawnPitch. */
  spawnPitch?: number;
  /** Size of modelUrl's file in bytes. See House.modelSizeBytes. */
  modelSizeBytes?: number;
}

type Status =
  | { phase: "downloading"; progress: number }
  | { phase: "processing"; progress: number }
  | { phase: "error"; message: string }
  | { phase: "ready" };

const LOADING_MESSAGES = [
  "Waking up the walls…",
  "Convincing gravity to cooperate…",
  "Untangling the floor plan…",
  "Sweeping up stray pixels…",
  "Measuring twice, rendering once…",
  "Bribing the Wi-Fi…",
];

// Virtual "keys" driven by on-screen touch buttons, tracked in the same pressed-keys set
// as real keyboard codes so the movement loop doesn't need to know the input source.
const TOUCH_FORWARD = "touch-forward";
const TOUCH_BACK = "touch-back";
const TOUCH_LEFT = "touch-left";
const TOUCH_RIGHT = "touch-right";
const TOUCH_UP = "touch-up";
const TOUCH_DOWN = "touch-down";

function TouchButton({
  label,
  onPress,
  onRelease,
  children,
}: {
  label: string;
  onPress: () => void;
  onRelease: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm active:bg-white/25 select-none touch-none"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
    >
      {children}
    </button>
  );
}

const ORIGIN_SPAWN = { x: 0, y: 0, z: 0 };

export function RoomExplorer({
  modelUrl,
  modelFormat,
  backHref,
  tiltDegrees = 0,
  rollDegrees = 0,
  spawnPosition = ORIGIN_SPAWN,
  spawnYaw = 0,
  spawnPitch = 0,
  modelSizeBytes,
}: RoomExplorerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pressedRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>({
    phase: "downloading",
    progress: 0,
  });
  const [locked, setLocked] = useState(false);
  const [pointCount, setPointCount] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  // This component is only ever mounted client-side (see room-explorer-client.tsx), so it's
  // safe to compute this eagerly instead of via an effect - there's no SSR output to mismatch.
  const [isTouchDevice] = useState(
    () =>
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches,
  );
  const speedTargetRef = useRef<{ set: (v: number) => void } | null>(null);
  // Set once the scene/camera exist (see the model-loading effect below); called by the
  // spawn-point effect further down so switching which room's spawn point is active just moves
  // the camera - it never touches the PlayCanvas app or re-fetches the (possibly huge) model.
  const gotoSpawnRef = useRef<
    | ((
        pos: { x: number; y: number; z: number },
        yaw: number,
        pitch: number,
      ) => void)
    | null
  >(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    const pressed = pressedRef.current;
    pressed.clear();

    // Camera state mirrors PlayCanvas's own reference fly-camera pattern (as used in
    // supersplat-viewer, PlayCanvas's official splat/point-cloud viewer): a single set of
    // Euler angles (pitch, yaw, roll=0) and a position, updated via basis vectors each frame,
    // rather than splitting rotation across an entity hierarchy or applying it as translateLocal.
    const angles = new pc.Vec3();
    const targetAngles = new pc.Vec3();
    const position = new pc.Vec3();
    const moveState = {
      baseSpeed: 1,
      fastMultiplier: 3,
      slowMultiplier: 0.3,
    };

    // Wall/floor/ceiling collision: a set of occupied voxel keys built from the loaded
    // point/splat positions once the asset finishes loading (see buildOccupancyGrid below).
    // null until then, which the movement code below treats as "no collision yet".
    let occupancyGrid: Set<number> | null = null;
    const COLLISION_VOXEL_SIZE = 0.2;
    const COLLISION_RADIUS = 0.25;
    const VOXEL_OFFSET = 20000;
    const VOXEL_BASE = VOXEL_OFFSET * 2;
    const voxelKey = (x: number, y: number, z: number) => {
      const vx = Math.floor(x / COLLISION_VOXEL_SIZE) + VOXEL_OFFSET;
      const vy = Math.floor(y / COLLISION_VOXEL_SIZE) + VOXEL_OFFSET;
      const vz = Math.floor(z / COLLISION_VOXEL_SIZE) + VOXEL_OFFSET;
      return (vx * VOXEL_BASE + vy) * VOXEL_BASE + vz;
    };
    const isOccupied = (x: number, y: number, z: number) =>
      occupancyGrid !== null && occupancyGrid.has(voxelKey(x, y, z));

    // Simple axis-aligned swept collision: each axis is tested independently against the
    // (possibly already-updated) position of the other axes, so motion along a blocked axis
    // stops while motion along the other two still applies - the camera slides along a wall
    // instead of stopping dead the moment it isn't moving exactly perpendicular into it. Each
    // probe is offset by COLLISION_RADIUS in the direction of travel so the camera stops at a
    // small standoff distance from the wall rather than clipping into it.
    const moveWithCollision = (offset: pc.Vec3) => {
      if (!occupancyGrid) {
        position.add(offset);
        return;
      }
      const marginX = offset.x >= 0 ? COLLISION_RADIUS : -COLLISION_RADIUS;
      const marginY = offset.y >= 0 ? COLLISION_RADIUS : -COLLISION_RADIUS;
      const marginZ = offset.z >= 0 ? COLLISION_RADIUS : -COLLISION_RADIUS;
      const nx = position.x + offset.x;
      const ny = position.y + offset.y;
      const nz = position.z + offset.z;
      if (!isOccupied(nx + marginX, position.y, position.z)) position.x = nx;
      if (!isOccupied(position.x, ny + marginY, position.z)) position.y = ny;
      if (!isOccupied(position.x, position.y, nz + marginZ)) position.z = nz;
    };
    speedTargetRef.current = {
      set: (v: number) => {
        moveState.baseSpeed = Math.min(50, Math.max(0.1, v));
        setSpeed(moveState.baseSpeed);
      },
    };

    const rotateSensitivity = 0.15;
    const rotateDamping = 0.95;
    const pitchLimit = 89;

    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: { antialias: true },
    });

    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    const onResize = () => app.resizeCanvas();
    window.addEventListener("resize", onResize);

    const camera = new pc.Entity("camera");
    camera.addComponent("camera", {
      fov: 70,
      clearColor: new pc.Color(0.05, 0.06, 0.08),
      nearClip: 0.05,
      farClip: 2000,
    });
    app.root.addChild(camera);

    // Imperative repositioning, independent of asset loading - the spawn-point effect below
    // calls this directly so switching rooms is instant instead of tearing down/reloading the
    // scene. Also used here for the initial spawn, before the model has even started loading
    // (harmless - the canvas is covered by the loading overlay until status is "ready").
    const gotoSpawn = (
      pos: { x: number; y: number; z: number },
      yaw: number,
      pitch: number,
    ) => {
      position.set(pos.x, pos.y, pos.z);
      angles.set(pitch, yaw, 0);
      targetAngles.set(pitch, yaw, 0);
      camera.setPosition(position);
      camera.setEulerAngles(angles.x, angles.y, 0);
    };
    gotoSpawnRef.current = gotoSpawn;
    gotoSpawn(spawnPosition, spawnYaw, spawnPitch);

    // --- keyboard ---
    const trackedCodes = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "ShiftLeft",
      "ShiftRight",
      "ControlLeft",
      "ControlRight",
      "KeyC",
      "KeyE",
      "KeyQ",
    ]);
    const onKeyDown = (e: KeyboardEvent) => {
      if (trackedCodes.has(e.code)) e.preventDefault();
      pressed.add(e.code);
      // Dev helper: print the current pose in a form ready to paste as a Room's spawn point.
      if (e.code === "KeyP") {
        console.log(
          `spawnPosition: { x: ${position.x.toFixed(2)}, y: ${position.y.toFixed(2)}, z: ${position.z.toFixed(2)} }, spawnYaw: ${angles.y.toFixed(1)}, spawnPitch: ${angles.x.toFixed(1)}`,
        );
      }
    };
    const onKeyUp = (e: KeyboardEvent) => pressed.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // --- mouse look (pointer lock) ---
    // Raw input only ever nudges targetAngles; the per-frame update loop below damps `angles`
    // toward it, which smooths out bursty mousemove/touchmove events instead of snapping the
    // camera directly - the likely cause of the "spinning" feeling from the previous version.
    const applyLook = (dx: number, dy: number) => {
      targetAngles.x -= dy * rotateSensitivity;
      targetAngles.y -= dx * rotateSensitivity;
      targetAngles.x = Math.max(
        -pitchLimit,
        Math.min(pitchLimit, targetAngles.x),
      );
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      applyLook(e.movementX, e.movementY);
    };
    document.addEventListener("mousemove", onMouseMove);

    const onPointerLockChange = () =>
      setLocked(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    const onCanvasPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        canvas.requestPointerLock();
      }
    };
    canvas.addEventListener("pointerdown", onCanvasPointerDown);

    // --- touch look (drag anywhere on the canvas) ---
    let touchLookId: number | null = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch || touchLookId !== null) return;
      touchLookId = touch.identifier;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier !== touchLookId) continue;
        applyLook(touch.clientX - lastTouchX, touch.clientY - lastTouchY);
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === touchLookId) touchLookId = null;
      }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });

    // --- scroll wheel adjusts move speed ---
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.001);
      speedTargetRef.current?.set(moveState.baseSpeed * factor);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // --- per-frame: damp rotation, then move + apply pose (ported from supersplat-viewer's
    // fly-controller.ts / camera-utils.ts: setCameraBasis + setBasisOffset) ---
    const rotationQuat = new pc.Quat();
    const forward = new pc.Vec3();
    const right = new pc.Vec3();
    const up = new pc.Vec3();
    const moveOffset = new pc.Vec3();

    const setCameraBasis = () => {
      rotationQuat.setFromEulerAngles(angles.x, angles.y, 0);
      rotationQuat.transformVector(pc.Vec3.FORWARD, forward);
      rotationQuat.transformVector(pc.Vec3.RIGHT, right);
      rotationQuat.transformVector(pc.Vec3.UP, up);
    };

    app.on("update", (dt: number) => {
      // damp angles toward the raw look target instead of snapping straight to it
      const t = 1 - Math.pow(rotateDamping, dt * 1000);
      angles.x += (targetAngles.x - angles.x) * t;
      angles.y += (targetAngles.y - angles.y) * t;

      const shift = pressed.has("ShiftLeft") || pressed.has("ShiftRight");
      const ctrl = pressed.has("ControlLeft") || pressed.has("ControlRight");
      const speed = shift
        ? moveState.baseSpeed * moveState.fastMultiplier
        : ctrl
          ? moveState.baseSpeed * moveState.slowMultiplier
          : moveState.baseSpeed;
      const d = speed * dt;

      const strafe =
        (pressed.has("KeyD") ||
        pressed.has("ArrowRight") ||
        pressed.has(TOUCH_RIGHT)
          ? 1
          : 0) -
        (pressed.has("KeyA") ||
        pressed.has("ArrowLeft") ||
        pressed.has(TOUCH_LEFT)
          ? 1
          : 0);
      const vertical =
        (pressed.has("KeyE") || pressed.has("Space") || pressed.has(TOUCH_UP)
          ? 1
          : 0) -
        (pressed.has("KeyQ") || pressed.has("KeyC") || pressed.has(TOUCH_DOWN)
          ? 1
          : 0);
      const move =
        (pressed.has("KeyW") ||
        pressed.has("ArrowUp") ||
        pressed.has(TOUCH_FORWARD)
          ? 1
          : 0) -
        (pressed.has("KeyS") ||
        pressed.has("ArrowDown") ||
        pressed.has(TOUCH_BACK)
          ? 1
          : 0);

      if (strafe || vertical || move) {
        setCameraBasis();
        const len =
          Math.sqrt(strafe * strafe + vertical * vertical + move * move) || 1;
        const scale = d / len;
        moveOffset.set(
          right.x * strafe * scale +
            up.x * vertical * scale +
            forward.x * move * scale,
          right.y * strafe * scale +
            up.y * vertical * scale +
            forward.y * move * scale,
          right.z * strafe * scale +
            up.z * vertical * scale +
            forward.z * move * scale,
        );
        moveWithCollision(moveOffset);
      }

      camera.setPosition(position);
      camera.setEulerAngles(angles.x, angles.y, 0);
    });

    app.start();

    // --- load the point cloud via PlayCanvas's own asset pipeline ---
    // A '.ply' URL loaded as a 'gsplat' asset is handled by the engine's built-in PlyParser
    // (src/framework/parsers/ply.js), which streams + parses arbitrary per-vertex PLY properties
    // (it's the same parser gaussian-splat assets use). 'load:data' hands us the raw parsed
    // GSplatData before the engine tries to turn it into a renderable gsplat resource - since our
    // file is a plain colored point cloud (just x/y/z/red/green/blue, no splat scale/rotation/SH),
    // we pull the properties out here and build our own point-cloud mesh instead of using
    // GSplatComponent.
    let handled = false;
    let loadedAsset: pc.Asset | null = null;

    const MODEL_CACHE_NAME = "3d-estate-models-v1";

    // Firefox's HTTP disk cache silently refuses to store any single response over ~50MB
    // (browser.cache.disk.max_entry_size) - a splat/point-cloud file this size would never be
    // cached there no matter what Cache-Control headers the server sends, so every visit would
    // re-download the whole thing. The Cache Storage API (the mechanism service workers use for
    // offline asset caching) is a separate store with a much larger, disk-space-based quota, so
    // it's used explicitly here instead of relying on the browser's implicit HTTP cache. A cheap
    // HEAD request compares ETags so a re-uploaded model (see scripts/upload-models.mjs's
    // allowOverwrite) doesn't get stuck serving a stale cached copy forever.
    const fetchModelResponse = async (url: string): Promise<Response> => {
      if (typeof caches === "undefined") {
        return fetch(url);
      }
      try {
        const cache = await caches.open(MODEL_CACHE_NAME);
        const [cached, head] = await Promise.all([
          cache.match(url),
          fetch(url, { method: "HEAD" }).catch(() => null),
        ]);
        const freshEtag = head?.headers.get("etag");
        if (
          cached &&
          (!freshEtag || freshEtag === cached.headers.get("etag"))
        ) {
          return cached;
        }
        const response = await fetch(url);
        if (response.ok) {
          cache.put(url, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        return fetch(url);
      }
    };

    const loadModel = async () => {
      let contents: Response | undefined;
      try {
        contents = await fetchModelResponse(modelUrl);
      } catch {
        // fall back to letting PlayCanvas's own fetch handle (and report) the error below
      }
      if (destroyed) return;

      // PlayCanvas's .d.ts types file.contents as ArrayBuffer, but the actual gsplat/PLY runtime
      // (PlyParser.load) reads `.body`/`.headers` directly off it - it genuinely expects a
      // Response, a real mismatch between the published types and the engine's own source.
      const file = contents
        ? { url: modelUrl, contents: contents as unknown as ArrayBuffer }
        : { url: modelUrl };
      const asset = new pc.Asset(modelUrl, "gsplat", file, { reorder: false });
      loadedAsset = asset;

      asset.on("progress", (received: number, total: number) => {
        // Vercel Blob serves large files dynamically Brotli-compressed with no Content-Length
        // header, so `total` from the engine is always 0 for them - modelSizeBytes (recorded at
        // upload time, see scripts/upload-models.mjs) is the only reliable size available.
        const effectiveTotal = modelSizeBytes ?? total;
        if (!destroyed && !handled && effectiveTotal > 0) {
          setStatus({
            phase: "downloading",
            progress: Math.min(1, received / effectiveTotal),
          });
        }
      });

      // The heavy per-point work below (sorting for percentiles, building the collision grid) is
      // synchronous and can take a noticeable moment for a multi-million-point splat - yielding
      // to the browser's render loop between the major steps (rather than doing it all in one
      // blocking call) lets the "processing" progress below actually paint instead of jumping
      // straight from download to ready. Shared by both the .ply and .sog paths below.
      const yieldToRender = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      // Both point clouds and gaussian splats (.ply or .sog) size up the scene (and thus the
      // initial camera move speed) the same way, so switching between them never changes how
      // movement feels. Scans/captures of either kind can contain stray "floater" points far from
      // the actual subject - trained gaussian splats in particular often carry thousands of
      // unpruned low-opacity background splats scattered across the whole training volume.
      // Standard deviation is NOT robust to this: even a few percent of points spread far away
      // dominates the variance sum and inflates the estimate by 10x or more. The 5th/95th
      // percentile per axis ignores those outliers entirely regardless of how far they are.
      const PERCENTILE_TRIM = 0.05;
      const percentileRange = (values: ArrayLike<number>) => {
        const finite = new Float32Array(values.length);
        let finiteCount = 0;
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (Number.isFinite(v)) finite[finiteCount++] = v;
        }
        const sorted = finite.subarray(0, finiteCount).sort();
        const n = sorted.length;
        if (n === 0) return { lo: 0, hi: 0 };
        const lo = sorted[Math.floor((n - 1) * PERCENTILE_TRIM)];
        const hi = sorted[Math.floor((n - 1) * (1 - PERCENTILE_TRIM))];
        return { lo, hi };
      };
      const computeSceneBounds = (
        xs: ArrayLike<number>,
        ys: ArrayLike<number>,
        zs: ArrayLike<number>,
      ) => {
        const rx = percentileRange(xs);
        const ry = percentileRange(ys);
        const rz = percentileRange(zs);
        const centerX = (rx.lo + rx.hi) / 2;
        const centerY = (ry.lo + ry.hi) / 2;
        const centerZ = (rz.lo + rz.hi) / 2;
        // the trimmed window is narrower than the true extent by design, so pad it back out
        const halfX = ((rx.hi - rx.lo) / 2) * 1.2;
        const halfY = ((ry.hi - ry.lo) / 2) * 1.2;
        const halfZ = ((rz.hi - rz.lo) / 2) * 1.2;
        const radius = Math.sqrt(halfX * halfX + halfY * halfY + halfZ * halfZ);
        return { centerX, centerY, centerZ, radius };
      };

      // House.tiltDegrees (X) corrects for scanning/training tools disagreeing on which axis is
      // "up"; House.rollDegrees (Z) corrects any residual bank left once tilt is right (a scan
      // that wasn't perfectly level makes walls appear to bank as the camera pans). Both are
      // baked into one correction so point clouds and gaussian splats are leveled identically,
      // regardless of file format.
      const correctionRotation = new pc.Quat().setFromEulerAngles(tiltDegrees, 0, rollDegrees);

      // Wall/floor/ceiling collision grid, built from the same world-space (corrected +
      // recentered) points the camera moves through - identical for point clouds and gaussian
      // splats of either format, so bumping into geometry feels the same regardless of which one
      // loaded.
      const buildOccupancyGrid = (
        xs: ArrayLike<number>,
        ys: ArrayLike<number>,
        zs: ArrayLike<number>,
        count: number,
        centerX: number,
        centerY: number,
        centerZ: number,
      ) => {
        const grid = new Set<number>();
        const scratch = new pc.Vec3();
        for (let i = 0; i < count; i++) {
          scratch.set(xs[i] - centerX, ys[i] - centerY, zs[i] - centerZ);
          correctionRotation.transformVector(scratch, scratch);
          grid.add(voxelKey(scratch.x, scratch.y, scratch.z));
        }
        return grid;
      };

      if (modelFormat === "sog") {
        // .sog never fires 'load:data' (it's a zip bundle of pre-quantized GPU textures decoded
        // entirely by shaders) - the engine renders it natively once the asset is attached to a
        // gsplat component, so there's no custom mesh-building here. But the engine DOES prepare
        // a CPU-side `centers` array (interleaved x,y,z per splat) by default for every gsplat
        // format, via a GPU decode-and-readback (Scene#gsplatCentersEnabled, on by default) -
        // confirmed directly in the engine source: GSplatResourceBase's constructor calls
        // gsplatData.getCenters(), and for .sog that's backed by a shader that decodes the
        // means_l/means_u textures and reads the result back to the CPU. That gives .sog the
        // exact same percentile-bounds + collision-grid treatment as .ply, just sourced from
        // `resource.centers` instead of PlyParser's per-property arrays.
        const sogEntity = new pc.Entity("gaussian-splat-sog");
        sogEntity.addComponent("gsplat", { asset });
        app.root.addChild(sogEntity);

        const processSogResource = async (resource: pc.GSplatResourceBase) => {
          const centers = resource.centers;
          const count =
            resource.gsplatData?.numSplats ?? (centers ? centers.length / 3 : 0);

          if (centers && count > 0) {
            setStatus({ phase: "processing", progress: 0.1 });
            await yieldToRender();
            if (destroyed) return;

            const xs = new Float32Array(count);
            const ys = new Float32Array(count);
            const zs = new Float32Array(count);
            for (let i = 0; i < count; i++) {
              xs[i] = centers[i * 3];
              ys[i] = centers[i * 3 + 1];
              zs[i] = centers[i * 3 + 2];
            }

            const { centerX, centerY, centerZ, radius } = computeSceneBounds(xs, ys, zs);
            setStatus({ phase: "processing", progress: 0.5 });
            await yieldToRender();
            if (destroyed) return;

            const rotatedCenter = correctionRotation.transformVector(
              new pc.Vec3(centerX, centerY, centerZ),
              new pc.Vec3(),
            );
            sogEntity.setRotation(correctionRotation);
            sogEntity.setPosition(
              -rotatedCenter.x,
              -rotatedCenter.y,
              -rotatedCenter.z,
            );

            occupancyGrid = buildOccupancyGrid(xs, ys, zs, count, centerX, centerY, centerZ);
            setStatus({ phase: "processing", progress: 0.9 });
            await yieldToRender();
            if (destroyed) return;

            speedTargetRef.current?.set(Math.max(0.6, radius * 0.35));
            setPointCount(count);
          } else {
            // Fallback if centers weren't prepared (e.g. Scene#gsplatCentersEnabled was disabled
            // app-wide) - recenter from the resource's plain aabb and skip collision, same as
            // this component's very first .sog implementation.
            const rotatedCenter = correctionRotation.transformVector(
              resource.aabb.center,
              new pc.Vec3(),
            );
            sogEntity.setRotation(correctionRotation);
            sogEntity.setPosition(
              -rotatedCenter.x,
              -rotatedCenter.y,
              -rotatedCenter.z,
            );
            speedTargetRef.current?.set(
              Math.max(0.6, resource.aabb.halfExtents.length() * 0.35),
            );
            setPointCount(resource.gsplatData?.numSplats ?? null);
          }

          handled = true;
          setStatus({ phase: "ready" });
        };

        asset.on("load", (readyAsset: pc.Asset) => {
          if (destroyed || handled) return;
          const resource = readyAsset.resource as pc.GSplatResourceBase | null;
          if (!resource) {
            handled = true;
            setStatus({
              phase: "error",
              message: "Gaussian splat file loaded with no resource",
            });
            return;
          }
          processSogResource(resource).catch((err) => {
            handled = true;
            setStatus({
              phase: "error",
              message:
                err instanceof Error
                  ? err.message
                  : "Failed to load the 3D model",
            });
          });
        });

        asset.on("error", (err: string) => {
          if (destroyed || handled) return;
          setStatus({
            phase: "error",
            message: err || "Failed to load the 3D model",
          });
        });

        app.assets.add(asset);
        app.assets.load(asset);
        return;
      }

      const processModelData = async (data: pc.GSplatData) => {
        const count = data.numSplats;
        const xs = data.getProp("x");
        const ys = data.getProp("y");
        const zs = data.getProp("z");
        if (!xs || !ys || !zs) {
          throw new Error("PLY file is missing x/y/z vertex properties");
        }

        setStatus({ phase: "processing", progress: 0.05 });
        await yieldToRender();
        if (destroyed) return;

        // A real trained gaussian splat carries per-splat shape/color (scale, rotation,
        // spherical harmonics) - that needs the engine's native GSplatComponent renderer. A
        // plain scanner point cloud (just x/y/z/red/green/blue, like the Polycam file) has none
        // of that, so it's rendered as flat dots via our own mesh/shader instead.
        const isGaussianSplat = !!(
          data.getProp("scale_0") && data.getProp("rot_0")
        );

        if (isGaussianSplat) {
          const {
            centerX: meanX,
            centerY: meanY,
            centerZ: meanZ,
            radius,
          } = computeSceneBounds(xs, ys, zs);
          setStatus({ phase: "processing", progress: 0.5 });
          await yieldToRender();
          if (destroyed) return;

          // Since we're not rewriting a million+ splats worth of data, the correction and the
          // recentering live entirely in the container entity's transform.
          const rotatedCenter = correctionRotation.transformVector(
            new pc.Vec3(meanX, meanY, meanZ),
            new pc.Vec3(),
          );

          const splatEntity = new pc.Entity("gaussian-splat");
          splatEntity.setRotation(correctionRotation);
          splatEntity.setPosition(
            -rotatedCenter.x,
            -rotatedCenter.y,
            -rotatedCenter.z,
          );
          splatEntity.addComponent("gsplat", { asset });
          app.root.addChild(splatEntity);

          occupancyGrid = buildOccupancyGrid(xs, ys, zs, count, meanX, meanY, meanZ);
          setStatus({ phase: "processing", progress: 0.9 });
          await yieldToRender();
          if (destroyed) return;

          speedTargetRef.current?.set(Math.max(0.6, radius * 0.35));
          setPointCount(count);
          handled = true;
          setStatus({ phase: "ready" });
          return;
        }

        const rs = data.getProp("red");
        const gs = data.getProp("green");
        const bs = data.getProp("blue");

        // After this event, PlyParser always goes on to build a GSplatResource for real
        // gaussian-splat rendering - which we don't use here, but which crashes if the standard
        // splat properties aren't present (our file only has x/y/z/red/green/blue). Patch in
        // inert placeholders so that construction no-ops instead of throwing.
        const ensureProp = (name: string, value: number) => {
          if (!data.getProp(name)) {
            data.addProp(name, new Float32Array(count).fill(value));
          }
        };
        ensureProp("rot_0", 1);
        ensureProp("rot_1", 0);
        ensureProp("rot_2", 0);
        ensureProp("rot_3", 0);
        ensureProp("scale_0", -10);
        ensureProp("scale_1", -10);
        ensureProp("scale_2", -10);
        ensureProp("f_dc_0", 0);
        ensureProp("f_dc_1", 0);
        ensureProp("f_dc_2", 0);
        ensureProp("opacity", -10);

        const { centerX, centerY, centerZ, radius } = computeSceneBounds(xs, ys, zs);
        setStatus({ phase: "processing", progress: 0.4 });
        await yieldToRender();
        if (destroyed) return;

        // Correction applied around the scene center so the origin sits in open space in the
        // room; a scratch vector avoids allocating one per point across potentially millions.
        const positions = new Float32Array(count * 3);
        const colors = new Uint8Array(count * 4);
        const scratch = new pc.Vec3();
        // Points are already being visited to build the render mesh, so the collision grid is
        // filled in from the same world-space positions here instead of a second full pass.
        const grid = new Set<number>();
        for (let i = 0; i < count; i++) {
          scratch.set(xs[i] - centerX, ys[i] - centerY, zs[i] - centerZ);
          correctionRotation.transformVector(scratch, scratch);
          positions[i * 3] = scratch.x;
          positions[i * 3 + 1] = scratch.y;
          positions[i * 3 + 2] = scratch.z;
          colors[i * 4] = rs ? rs[i] : 210;
          colors[i * 4 + 1] = gs ? gs[i] : 210;
          colors[i * 4 + 2] = bs ? bs[i] : 210;
          colors[i * 4 + 3] = 255;
          grid.add(voxelKey(scratch.x, scratch.y, scratch.z));
        }
        occupancyGrid = grid;
        setStatus({ phase: "processing", progress: 0.9 });
        await yieldToRender();
        if (destroyed) return;

        const mesh = new pc.Mesh(app.graphicsDevice);
        mesh.setPositions(positions);
        mesh.setColors32(colors);
        mesh.update(pc.PRIMITIVE_POINTS);

        const material = new pc.ShaderMaterial({
          uniqueName: `point-cloud-material-${modelUrl}`,
          attributes: {
            aPosition: pc.SEMANTIC_POSITION,
            aColor: pc.SEMANTIC_COLOR,
          },
          vertexGLSL: POINT_CLOUD_VERTEX_GLSL,
          fragmentGLSL: POINT_CLOUD_FRAGMENT_GLSL,
        });
        material.update();

        const worldPointSize = Math.max(0.01, (radius / Math.sqrt(count)) * 4);
        material.setParameter("uWorldPointSize", worldPointSize);
        material.setParameter("uMinPointSize", 2.0);
        material.setParameter("uMaxPointSize", 48.0);

        const updatePixelSizeFactor = () => {
          const fov = camera.camera?.fov ?? 70;
          const fovRad = (fov * Math.PI) / 180;
          const factor = app.graphicsDevice.height / (2 * Math.tan(fovRad / 2));
          material.setParameter("uPixelSizeFactor", factor);
        };
        updatePixelSizeFactor();
        app.graphicsDevice.on("resizecanvas", updatePixelSizeFactor);

        const meshInstance = new pc.MeshInstance(mesh, material);
        const pointCloudEntity = new pc.Entity("point-cloud");
        pointCloudEntity.addComponent("render", {
          meshInstances: [meshInstance],
        });
        app.root.addChild(pointCloudEntity);

        speedTargetRef.current?.set(Math.max(0.6, radius * 0.35));
        setPointCount(count);
        handled = true;
        setStatus({ phase: "ready" });
      };

      asset.on("load:data", (data: pc.GSplatData) => {
        if (destroyed || handled) return;
        processModelData(data).catch((err) => {
          handled = true;
          setStatus({
            phase: "error",
            message:
              err instanceof Error
                ? err.message
                : "Failed to load the 3D model",
          });
        });
      });

      asset.on("error", (err: string) => {
        if (destroyed || handled) return;
        setStatus({
          phase: "error",
          message: err || "Failed to load the 3D model",
        });
      });

      app.assets.add(asset);
      app.assets.load(asset);
    };

    loadModel();

    return () => {
      destroyed = true;
      if (loadedAsset) app.assets.remove(loadedAsset);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      canvas.removeEventListener("wheel", onWheel);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      gotoSpawnRef.current = null;
      app.destroy();
    };
    // spawnPosition/spawnYaw/spawnPitch are intentionally not deps: this effect owns loading the
    // (potentially huge) model, which shouldn't happen again just because the active room's spawn
    // point changed. The initial gotoSpawn() call above always reads their current values; the
    // effect below handles repositioning after that without reloading anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl, modelFormat, retryKey, tiltDegrees, rollDegrees, modelSizeBytes]);

  // Runs whenever the active room's spawn point changes, independent of the model-loading effect
  // above - switching rooms within the same house is instant, no re-fetch of the model.
  useEffect(() => {
    gotoSpawnRef.current?.(
      { x: spawnPosition.x, y: spawnPosition.y, z: spawnPosition.z },
      spawnYaw,
      spawnPitch,
    );
  }, [spawnPosition.x, spawnPosition.y, spawnPosition.z, spawnYaw, spawnPitch]);

  const press = (code: string) => pressedRef.current.add(code);
  const release = (code: string) => pressedRef.current.delete(code);
  const nudgeSpeed = (factor: number) => {
    const target = speedTargetRef.current;
    if (!target) return;
    setSpeed((prev) => {
      const next = Math.min(50, Math.max(0.1, prev * factor));
      target.set(next);
      return next;
    });
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none outline-none"
      />

      {(status.phase === "downloading" || status.phase === "processing") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-white">
          <Loader2 className="size-8 animate-spin" />
          <WordRotate
            words={LOADING_MESSAGES}
            duration={1800}
            className="text-2xl font-medium text-white/80"
          />
          {/* This overlay is always dark regardless of app theme, so the default bg-primary
              indicator (near-black in light mode) would be invisible here - overridden via the
              data-slot attributes the primitives already expose rather than the theme tokens. */}
          <Progress
            value={Math.round(status.progress * 100)}
            className="w-80 flex-col items-center gap-2 **:data-[slot=progress-track]:h-3 **:data-[slot=progress-track]:bg-white/15 **:data-[slot=progress-indicator]:bg-white"
          >
            <ProgressValue className="text-sm text-white/60" />
          </Progress>
        </div>
      )}

      {status.phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center text-white">
          <TriangleAlert className="size-8 text-red-400" />
          <p className="max-w-sm text-sm text-white/80">{status.message}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStatus({ phase: "downloading", progress: 0 });
                setRetryKey((k) => k + 1);
              }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Try again
            </button>
            <Link
              href={backHref}
              className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white"
            >
              Back
            </Link>
          </div>
        </div>
      )}

      {status.phase === "ready" && !isTouchDevice && !locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/60 px-6 text-center text-white">
          <MousePointerClick className="size-8" />
          <div className="space-y-1">
            <p className="text-lg font-medium">Explore the house</p>
            <p className="max-w-sm text-sm text-white/70">
              WASD to move · mouse to look · Q/E (or Space) for down/up · Shift
              faster · Ctrl slower · scroll to change speed · Esc to release the
              cursor
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => canvasRef.current?.requestPointerLock()}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black"
            >
              Start exploring
            </button>
            <Link
              href={backHref}
              className="flex items-center gap-1.5 rounded-lg border border-white/30 px-4 py-2.5 text-sm font-medium text-white"
            >
              <ArrowLeft className="size-4" />
              Back to house
            </Link>
          </div>
          {pointCount !== null && (
            <p className="text-xs text-white/40">
              {pointCount.toLocaleString()} points
            </p>
          )}
        </div>
      )}

      {status.phase === "ready" && locked && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/40 px-3 py-1.5 text-xs text-white/70">
            Esc to release the cursor · scroll to change speed (
            {speed.toFixed(1)}x)
          </div>
        </>
      )}

      {status.phase === "ready" && isTouchDevice && (
        <>
          <Link
            href={backHref}
            className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-md bg-black/40 px-3 py-1.5 text-xs text-white/70">
            Drag anywhere to look around
          </div>
          <div className="absolute bottom-6 left-4 flex flex-col items-center gap-1.5">
            <TouchButton
              label="Move forward"
              onPress={() => press(TOUCH_FORWARD)}
              onRelease={() => release(TOUCH_FORWARD)}
            >
              <ArrowUp className="size-5" />
            </TouchButton>
            <div className="flex gap-1.5">
              <TouchButton
                label="Move left"
                onPress={() => press(TOUCH_LEFT)}
                onRelease={() => release(TOUCH_LEFT)}
              >
                <ArrowLeft className="size-5" />
              </TouchButton>
              <TouchButton
                label="Move back"
                onPress={() => press(TOUCH_BACK)}
                onRelease={() => release(TOUCH_BACK)}
              >
                <ArrowDown className="size-5" />
              </TouchButton>
              <TouchButton
                label="Move right"
                onPress={() => press(TOUCH_RIGHT)}
                onRelease={() => release(TOUCH_RIGHT)}
              >
                <ArrowRight className="size-5" />
              </TouchButton>
            </div>
          </div>
          <div className="absolute bottom-6 right-4 flex flex-col items-center gap-1.5">
            <TouchButton
              label="Move up"
              onPress={() => press(TOUCH_UP)}
              onRelease={() => release(TOUCH_UP)}
            >
              <ChevronUp className="size-5" />
            </TouchButton>
            <TouchButton
              label="Move down"
              onPress={() => press(TOUCH_DOWN)}
              onRelease={() => release(TOUCH_DOWN)}
            >
              <ChevronDown className="size-5" />
            </TouchButton>
          </div>
          <div className="absolute right-4 top-4 flex gap-1.5">
            <TouchButton
              label="Slower"
              onPress={() => nudgeSpeed(0.75)}
              onRelease={() => {}}
            >
              <Minus className="size-5" />
            </TouchButton>
            <TouchButton
              label="Faster"
              onPress={() => nudgeSpeed(1.25)}
              onRelease={() => {}}
            >
              <Plus className="size-5" />
            </TouchButton>
          </div>
        </>
      )}
    </div>
  );
}
