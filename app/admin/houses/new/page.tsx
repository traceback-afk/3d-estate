"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import type { House } from "@/types/estate";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function modelFormatFromFilename(filename: string): "ply" | "sog" | null {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (ext === ".ply") return "ply";
  if (ext === ".sog") return "sog";
  return null;
}

export default function NewHousePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [tiltDegrees, setTiltDegrees] = useState(0);
  const [rollDegrees, setRollDegrees] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitting = uploadPercent !== null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a .ply or .sog model file.");
      return;
    }
    const modelFormat = modelFormatFromFilename(file.name);
    if (!modelFormat) {
      setError("Only .ply and .sog files are supported.");
      return;
    }

    setUploadPercent(0);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob-upload",
        multipart: true,
        onUploadProgress: ({ percentage }) => setUploadPercent(percentage),
      });

      const res = await fetch("/api/houses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          description,
          modelUrl: blob.url,
          modelFormat,
          modelSizeBytes: file.size,
          tiltDegrees,
          rollDegrees,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create house");
      }
      const house: House = await res.json();
      router.push(`/admin/houses/${house.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setUploadPercent(null);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Manage listings
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">New house</h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Name
            <input
              className={inputClassName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Address
            <input
              className={inputClassName}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Description
            <textarea
              className={inputClassName}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tilt (X axis, degrees)
              <input
                type="number"
                className={inputClassName}
                value={tiltDegrees}
                onChange={(e) => setTiltDegrees(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Roll (Z axis, degrees)
              <input
                type="number"
                className={inputClassName}
                value={rollDegrees}
                onChange={(e) => setRollDegrees(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Scanning/training tools don&apos;t all agree on which axis is &quot;up&quot; - nudge tilt (try 90,
            -90, or 180) until the scan loads right-side up, then roll in small steps if walls
            still bank while panning. Both can be fine-tuned here after a first look.
          </p>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Model file (.ply or .sog)
            <input
              type="file"
              accept=".ply,.sog"
              className={inputClassName}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {submitting && (
            <Progress value={uploadPercent} className="w-full">
              <ProgressLabel className="text-sm text-muted-foreground">
                Uploading model…
              </ProgressLabel>
              <ProgressValue className="text-sm text-muted-foreground" />
            </Progress>
          )}

          <Button type="submit" size="lg" disabled={submitting} className="mt-2">
            {submitting ? "Uploading…" : "Create house"}
          </Button>
        </form>
      </main>
    </div>
  );
}
