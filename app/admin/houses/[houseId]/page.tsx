import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { EditHouseForm } from "@/components/admin/edit-house-form";
import { ReplaceModelForm } from "@/components/admin/replace-model-form";
import { RoomManager } from "@/components/admin/room-manager";
import { getBaseUrl } from "@/lib/base-url";
import type { House } from "@/types/estate";

export default async function EditHousePage({
  params,
}: {
  params: Promise<{ houseId: string }>;
}) {
  const { houseId } = await params;
  const res = await fetch(`${await getBaseUrl()}/api/houses/${houseId}`, { cache: "no-store" });
  if (res.status === 404) notFound();
  const house: House = await res.json();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Manage listings
          </Link>
          <Link
            href={`/houses/${house.id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            View listing
            <ExternalLink className="size-3.5" />
          </Link>
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{house.name}</h1>
        <p className="mt-1 break-all text-xs text-muted-foreground">
          {house.modelFormat.toUpperCase()} model · {house.modelUrl}
        </p>

        <div className="mt-6">
          <EditHouseForm house={house} />
        </div>

        <div className="mt-4">
          <ReplaceModelForm houseId={house.id} />
        </div>

        <h2 className="mt-10 text-lg font-medium">Rooms</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rooms are named spawn points within the shared model above, not separate files. Explore
          the house, press &quot;P&quot; to print your current position/look direction, then paste
          it in below.
        </p>
        <div className="mt-4">
          <RoomManager houseId={house.id} rooms={house.rooms} />
        </div>
      </main>
    </div>
  );
}
