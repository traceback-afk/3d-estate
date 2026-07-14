"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteHouseButton({ houseId, houseName }: { houseId: string; houseName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`Delete "${houseName}"? This also deletes its rooms. This can't be undone.`)) {
          return;
        }
        setPending(true);
        const res = await fetch(`/api/houses/${houseId}`, { method: "DELETE" });
        if (!res.ok) {
          alert("Failed to delete house.");
          setPending(false);
          return;
        }
        router.refresh();
      }}
    >
      <Trash2 className="size-3.5" />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
