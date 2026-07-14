import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODELS_DIR = path.join(process.cwd(), "3dmodels");

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await context.params;

  // Strip any directory components so requests can't escape MODELS_DIR.
  const filename = path.basename(rawFilename);
  if (!filename.toLowerCase().endsWith(".ply")) {
    return NextResponse.json({ error: "Only .ply files can be served" }, { status: 400 });
  }

  const filePath = path.join(MODELS_DIR, filename);

  let fileSize: number;
  try {
    const stats = await stat(filePath);
    fileSize = stats.size;
  } catch {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const nodeStream = createReadStream(filePath);

  return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fileSize),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
