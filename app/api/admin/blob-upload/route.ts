// Mints scoped client-upload tokens so the admin form's file input uploads directly from the
// browser to Vercel Blob (see @vercel/blob's client-upload flow) instead of buffering a
// potentially 250MB+ .ply/.sog file through this Next.js function.
//
// No auth here - matches the rest of /admin (explicitly not needed yet). Anyone who can reach
// this route can upload a .ply/.sog file to the public Blob store; the file extension check below
// is the only gate.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const ext = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
        if (ext !== ".ply" && ext !== ".sog") {
          throw new Error("Only .ply and .sog files are accepted");
        }
        return {
          access: "public" as const,
          addRandomSuffix: true,
          // Generous ceiling for large scans, not a real expectation of hitting it.
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        // No-op: the admin form creates the House/updates the model itself once upload()
        // resolves client-side with the blob's URL/size - nothing to persist from here.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
