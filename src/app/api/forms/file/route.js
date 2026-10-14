import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const download = searchParams.get("download") === "1";

    if (!id) {
      return NextResponse.json({ success: false, error: "Form ID is required" }, { status: 400 });
    }

    const row = await prisma.uploadedForms.findUnique({
      where: { Id: parseInt(id, 10) },
      select: {
        FileName: true,
        FileType: true,
        FileData: true,
      },
    });

    if (!row || !row.FileData) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    const buffer = Buffer.from(row.FileData);
    const contentType = row.FileType || "application/octet-stream";
    const disposition = download ? `attachment; filename="${encodeURIComponent(row.FileName)}"` : "inline";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Error serving file via Prisma:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
