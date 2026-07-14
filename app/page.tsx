import Link from "next/link";
import { DoorOpen, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { houses } from "@/lib/estate-data";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Houses</h1>
        <p className="mt-1 text-muted-foreground">
          Browse listed properties and explore their 3D house scans.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {houses.map((house) => (
            <Link
              key={house.id}
              href={`/houses/${house.id}`}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <DoorOpen className="size-5" />
              </div>
              <h2 className="mt-4 font-medium">{house.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {house.address}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {house.rooms.length > 0
                  ? `${house.rooms.length} room${house.rooms.length === 1 ? "" : "s"} to explore`
                  : "3D house scan"}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
