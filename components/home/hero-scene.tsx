"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import * as pc from "playcanvas";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

interface Stage {
  eyebrow: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}

export const STAGES: Stage[] = [
  {
    eyebrow: "3D Estate",
    title: "Walk through before you visit",
    body: "Every listing comes with a full 3D scan you can explore room by room, right from your browser.",
  },
  {
    eyebrow: "Explore in 3D",
    title: "See every room, from every angle",
    body: "Pan through the living room, check the light, get a feel for the space - before you ever book a viewing.",
  },
  {
    eyebrow: "Start browsing",
    title: "Find your next place, virtually",
    body: "Skip the guesswork. Explore real scans of real homes and shortlist the ones worth seeing in person.",
    cta: { label: "Browse houses", href: "#listings" },
  },
];

// Camera keyframes as offsets relative to the loaded model's bounding sphere (center + radius),
// so the fly-through scales to whatever the GLB's actual units/size turn out to be.
const CAMERA_STAGES: { pos: pc.Vec3; target: pc.Vec3 }[] = [
  { pos: new pc.Vec3(0, 0.55, 1.4), target: new pc.Vec3(0, -0.1, 0) },
  { pos: new pc.Vec3(1.05, 0.1, 0.2), target: new pc.Vec3(-0.35, -0.05, -0.15) },
  { pos: new pc.Vec3(-0.4, -0.15, -0.5), target: new pc.Vec3(0.45, -0.05, 0.5) },
];

export function HeroScene() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    let destroyed = false;

    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: { antialias: true },
    });
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    const onResize = () => app.resizeCanvas();
    window.addEventListener("resize", onResize);

    app.scene.ambientLight = new pc.Color(0.32, 0.32, 0.36);

    const keyLight = new pc.Entity("key-light");
    keyLight.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 0.97, 0.92),
      intensity: 2.2,
    });
    keyLight.setEulerAngles(55, 30, 0);
    app.root.addChild(keyLight);

    const fillLight = new pc.Entity("fill-light");
    fillLight.addComponent("light", {
      type: "directional",
      color: new pc.Color(0.6, 0.68, 0.8),
      intensity: 0.8,
    });
    fillLight.setEulerAngles(-40, -120, 0);
    app.root.addChild(fillLight);

    const camera = new pc.Entity("camera");
    camera.addComponent("camera", {
      fov: 45,
      clearColor: new pc.Color(0.04, 0.04, 0.05),
      nearClip: 0.05,
      farClip: 1000,
    });
    app.root.addChild(camera);

    // Placeholder bounds used until the model finishes loading and reports its real ones -
    // updated in place (not replaced) so the interpolation below always reads a live value.
    const bounds = { center: new pc.Vec3(0, 1, 0), radius: 4 };

    const scratchPos = new pc.Vec3();
    const scratchTarget = new pc.Vec3();
    const frameA = { pos: new pc.Vec3(), target: new pc.Vec3() };
    const frameB = { pos: new pc.Vec3(), target: new pc.Vec3() };

    const keyframeAt = (index: number, out: { pos: pc.Vec3; target: pc.Vec3 }) => {
      const stage = CAMERA_STAGES[index];
      out.pos.copy(stage.pos).mulScalar(bounds.radius).add(bounds.center);
      out.target.copy(stage.target).mulScalar(bounds.radius).add(bounds.center);
    };

    const stageEase = gsap.parseEase("power1.inOut");

    const applyProgress = (progress: number) => {
      const stageCount = CAMERA_STAGES.length;
      const t = pc.math.clamp(progress, 0, 1) * (stageCount - 1);
      const i = Math.min(stageCount - 2, Math.floor(t));
      const local = stageEase(t - i);

      keyframeAt(i, frameA);
      keyframeAt(i + 1, frameB);
      scratchPos.lerp(frameA.pos, frameB.pos, local);
      scratchTarget.lerp(frameA.target, frameB.target, local);
      camera.setPosition(scratchPos);
      camera.lookAt(scratchTarget);

      for (let s = 0; s < stageCount; s++) {
        const el = textRefs.current[s];
        if (!el) continue;
        const delta = t - s;
        const opacity = Math.max(0, 1 - Math.abs(delta));
        el.style.opacity = String(opacity);
        el.style.transform = `translateY(${delta * 28}px)`;
        el.style.pointerEvents = opacity > 0.6 ? "auto" : "none";
      }
    };

    applyProgress(0);
    app.start();

    const asset = new pc.Asset("hero-living-room", "container", {
      url: "/living_room_interior_free.glb",
    });
    asset.on("load", () => {
      if (destroyed) return;
      const resource = asset.resource as pc.ContainerResource;
      const modelEntity = resource.instantiateRenderEntity();
      app.root.addChild(modelEntity);

      const meshInstances = (modelEntity.findComponents("render") as pc.RenderComponent[]).flatMap(
        (render) => render.meshInstances,
      );
      if (meshInstances.length > 0) {
        const aabb = meshInstances[0].aabb.clone();
        for (let i = 1; i < meshInstances.length; i++) aabb.add(meshInstances[i].aabb);
        bounds.center.copy(aabb.center);
        bounds.radius = Math.max(0.5, aabb.halfExtents.length());
      }
    });
    app.assets.add(asset);
    app.assets.load(asset);

    const scrollTrigger = ScrollTrigger.create({
      trigger: wrapper,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      onUpdate: (self) => applyProgress(self.progress),
    });

    return () => {
      destroyed = true;
      scrollTrigger.kill();
      window.removeEventListener("resize", onResize);
      app.assets.remove(asset);
      app.destroy();
    };
  }, []);

  return (
    <section ref={wrapperRef} className="relative" style={{ height: `${STAGES.length * 100}vh` }}>
      <div className="sticky top-0 h-dvh w-full overflow-hidden bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          {STAGES.map((stage, i) => (
            <div
              key={stage.title}
              ref={(el) => {
                textRefs.current[i] = el;
              }}
              className="absolute max-w-xl text-center opacity-0"
            >
              <p className="text-sm font-medium tracking-widest text-white/60 uppercase">
                {stage.eyebrow}
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {stage.title}
              </h1>
              <p className="mt-4 text-lg text-balance text-white/75">{stage.body}</p>
              {stage.cta && (
                <Link
                  href={stage.cta.href}
                  className={cn(buttonVariants({ size: "lg" }), "pointer-events-auto mt-6")}
                >
                  {stage.cta.label}
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 text-white/50">
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <ArrowDown className="size-4 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
