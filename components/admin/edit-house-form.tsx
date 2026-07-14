"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { House } from "@/types/estate";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function EditHouseForm({ house }: { house: House }) {
  const router = useRouter();
  const [name, setName] = useState(house.name);
  const [address, setAddress] = useState(house.address);
  const [description, setDescription] = useState(house.description);
  const [tiltDegrees, setTiltDegrees] = useState(house.tiltDegrees ?? 0);
  const [rollDegrees, setRollDegrees] = useState(house.rollDegrees ?? 0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch(`/api/houses/${house.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, description, tiltDegrees, rollDegrees }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Failed to save changes.");
      return;
    }
    setSaved(true);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <input className={inputClassName} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Address
        <input className={inputClassName} value={address} onChange={(e) => setAddress(e.target.value)} required />
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
      </div>
    </form>
  );
}
