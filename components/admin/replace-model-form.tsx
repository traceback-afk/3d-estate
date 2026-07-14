"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function modelFormatFromFilename(filename: string): "ply" | "sog" | null {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (ext === ".ply") return "ply";
  if (ext === ".sog") return "sog";
  return null;
}

export function ReplaceModelForm({ houseId }: { houseId: string }) {
  const router = useRouter();
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

      const res = await fetch(`/api/houses/${houseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelUrl: blob.url,
          modelFormat,
          modelSizeBytes: file.size,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to update house with the new model");
      }
      setFile(null);
      setUploadPercent(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setUploadPercent(null);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-5"
    >
      <div>
        <p className="text-sm font-medium">Replace model</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Uploads a new .ply or .sog file and swaps it in for this house. Existing rooms keep
          their spawn points, but re-check them against the new scan - the model&apos;s origin may
          have shifted.
        </p>
      </div>

      <input
        type="file"
        accept=".ply,.sog"
        className={inputClassName}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {submitting && (
        <Progress value={uploadPercent} className="w-full">
          <ProgressLabel className="text-sm text-muted-foreground">Uploading model…</ProgressLabel>
          <ProgressValue className="text-sm text-muted-foreground" />
        </Progress>
      )}

      <Button type="submit" variant="outline" disabled={submitting || !file} className="self-start">
        {submitting ? "Uploading…" : "Replace model"}
      </Button>
    </form>
  );
}
