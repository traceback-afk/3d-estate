import Link from "next/link";
import { House } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <House className="size-5" />
          3D Estate
        </Link>
      </div>
    </header>
  );
}
