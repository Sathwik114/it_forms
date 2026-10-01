import { NextResponse } from "next/server";
import { getITFormsPool, sql } from "@/lib/itFormsDb";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const download = searchParams.get("download") === "1";

    if (!id) {
      return NextResponse.json({ success: false, error: "Form ID is required" }, { status: 400 });
    }

    const pool = await getITFormsPool();
    const result = await pool
      .request()
      .input("Id", sql.Int, parseInt(id, 10))
      .query("SELECT FileName, FileType, FileData FROM UploadedForms WHERE Id = @Id");

    if (!result.recordset || result.recordset.length === 0) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    const row = result.recordset[0];
    const buffer = row.FileData;
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
    console.error("Error serving file from ITForms DB:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
