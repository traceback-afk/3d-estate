"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Room } from "@/types/estate";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const numberInputClassName = `${inputClassName} text-right tabular-nums`;

interface RoomFormValues {
  name: string;
  description: string;
  spawnX: string;
  spawnY: string;
  spawnZ: string;
  spawnYaw: string;
  spawnPitch: string;
}

const EMPTY_ROOM: RoomFormValues = {
  name: "",
  description: "",
  spawnX: "",
  spawnY: "",
  spawnZ: "",
  spawnYaw: "",
  spawnPitch: "",
};

function roomToFormValues(room: Room): RoomFormValues {
  return {
    name: room.name,
    description: room.description,
    spawnX: room.spawnPosition ? String(room.spawnPosition.x) : "",
    spawnY: room.spawnPosition ? String(room.spawnPosition.y) : "",
    spawnZ: room.spawnPosition ? String(room.spawnPosition.z) : "",
    spawnYaw: room.spawnYaw !== undefined ? String(room.spawnYaw) : "",
    spawnPitch: room.spawnPitch !== undefined ? String(room.spawnPitch) : "",
  };
}

// Empty string means "unset" (spawn defaults to the model's origin) - only sent as a number when
// the admin actually typed one, so partially-filled spawn fields don't silently coerce to 0.
function toBody(values: RoomFormValues) {
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  return {
    name: values.name,
    description: values.description,
    spawnX: num(values.spawnX),
    spawnY: num(values.spawnY),
    spawnZ: num(values.spawnZ),
    spawnYaw: num(values.spawnYaw),
    spawnPitch: num(values.spawnPitch),
  };
}

function RoomFields({
  values,
  onChange,
}: {
  values: RoomFormValues;
  onChange: (values: RoomFormValues) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <input
          className={inputClassName}
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Description
        <input
          className={inputClassName}
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          required
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        {(["spawnX", "spawnY", "spawnZ"] as const).map((field) => (
          <label key={field} className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            {field.replace("spawn", "")}
            <input
              type="number"
              step="any"
              className={numberInputClassName}
              value={values[field]}
              placeholder="0"
              onChange={(e) => onChange({ ...values, [field]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Yaw
          <input
            type="number"
            step="any"
            className={numberInputClassName}
            value={values.spawnYaw}
            placeholder="0"
            onChange={(e) => onChange({ ...values, spawnYaw: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Pitch
          <input
            type="number"
            step="any"
            className={numberInputClassName}
            value={values.spawnPitch}
            placeholder="0"
            onChange={(e) => onChange({ ...values, spawnPitch: e.target.value })}
          />
        </label>
      </div>
    </>
  );
}

function RoomRow({ houseId, room }: { houseId: string; room: Room }) {
  const router = useRouter();
  const [values, setValues] = useState(roomToFormValues(room));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/houses/${houseId}/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toBody(values)),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Failed to save room.");
      return;
    }
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete room "${room.name}"?`)) return;
    const res = await fetch(`/api/houses/${houseId}/rooms/${room.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete room.");
      return;
    }
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <RoomFields values={values} onChange={setValues} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
    </form>
  );
}

function AddRoomForm({ houseId }: { houseId: string }) {
  const router = useRouter();
  const [values, setValues] = useState<RoomFormValues>(EMPTY_ROOM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/houses/${houseId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toBody(values)),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Failed to add room.");
      return;
    }
    setValues(EMPTY_ROOM);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleAdd}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
    >
      <p className="text-sm font-medium">Add a room</p>
      <RoomFields values={values} onChange={setValues} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={saving} className="self-start">
        {saving ? "Adding…" : "Add room"}
      </Button>
    </form>
  );
}

export function RoomManager({ houseId, rooms }: { houseId: string; rooms: Room[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rooms.map((room) => (
        <RoomRow key={room.id} houseId={houseId} room={room} />
      ))}
      <AddRoomForm houseId={houseId} />
    </div>
  );
}
