import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { DeleteHouseButton } from "@/components/admin/delete-house-button";
import { getBaseUrl } from "@/lib/base-url";
import type { House } from "@/types/estate";

export default async function AdminHousesPage() {
  const res = await fetch(`${await getBaseUrl()}/api/houses`, { cache: "no-store" });
  const houses: House[] = await res.json();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Site
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Manage listings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              No login is required for this page yet - anyone with the link can add, edit, or
              delete houses here.
            </p>
          </div>
          <Link
            href="/admin/houses/new"
            className={buttonVariants({ size: "lg", className: "shrink-0 gap-1.5" })}
          >
            <Plus className="size-4" />
            New house
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {houses.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No houses yet. Add one to get started.
            </p>
          )}
          {houses.map((house) => (
            <div
              key={house.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{house.name}</p>
                <p className="truncate text-sm text-muted-foreground">{house.address}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {house.modelFormat.toUpperCase()} · {house.rooms.length} room
                  {house.rooms.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/houses/${house.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Edit
                </Link>
                <DeleteHouseButton houseId={house.id} houseName={house.name} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
