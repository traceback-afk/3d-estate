import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Move3d } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getHouse, getRoom } from "@/lib/estate-data";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ houseId: string; roomId: string }>;
}) {
  const { houseId, roomId } = await params;
  const house = getHouse(houseId);
  const room = getRoom(houseId, roomId);
  if (!house || !room) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href={`/houses/${house.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {house.name}
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{room.name}</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">{room.description}</p>

        <div className="mt-8 flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Walk through this room in 3D</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Move around the scanned point cloud like a first-person game.
            </p>
          </div>
          <Link
            href={`/houses/${house.id}/rooms/${room.id}/explore`}
            className={buttonVariants({ size: "lg", className: "gap-2" })}
          >
            <Move3d className="size-4" />
            Explore in 3D
          </Link>
        </div>
      </main>
    </div>
  );
}
