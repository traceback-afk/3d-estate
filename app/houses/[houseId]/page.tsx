import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Box, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { getHouse } from "@/lib/estate-data";

export default async function HousePage({
  params,
}: {
  params: Promise<{ houseId: string }>;
}) {
  const { houseId } = await params;
  const house = getHouse(houseId);
  if (!house) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All houses
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{house.name}</h1>
        <p className="mt-1 flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-3.5" />
          {house.address}
        </p>
        <p className="mt-3 max-w-2xl text-muted-foreground">{house.description}</p>

        <h2 className="mt-10 text-lg font-medium">Rooms</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {house.rooms.map((room) => (
            <Link
              key={room.id}
              href={`/houses/${house.id}/rooms/${room.id}`}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Box className="size-5" />
              </div>
              <h3 className="mt-4 font-medium">{room.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{room.description}</p>
              <span className="mt-3 inline-block text-sm font-medium">Explore in 3D →</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
