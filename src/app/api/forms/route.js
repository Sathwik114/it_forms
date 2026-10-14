import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// GET /api/forms -> Fetch all uploaded forms from ITForms database (10.40.10.125) via Prisma
export async function GET() {
  try {
    const records = await prisma.uploadedForms.findMany({
      select: {
        Id: true,
        Description: true,
        FileName: true,
        FileType: true,
        FileSize: true,
        FileSizeFormatted: true,
        UploadedBy: true,
        UploadedAt: true,
      },
      orderBy: {
        UploadedAt: "desc",
      },
    });

    const forms = records.map((row) => ({
      id: row.Id,
      description: row.Description,
      fileName: row.FileName,
      fileType: row.FileType,
      fileSize: row.FileSize,
      fileSizeFormatted: row.FileSizeFormatted,
      fileUrl: `/api/forms/file?id=${row.Id}`,
      downloadUrl: `/api/forms/file?id=${row.Id}&download=1`,
      uploadedBy: row.UploadedBy,
      uploadedAt: row.UploadedAt,
    }));

    return NextResponse.json({ success: true, forms });
  } catch (err) {
    console.error("Error fetching forms from ITForms DB via Prisma:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/forms -> Save new uploaded form into ITForms database (10.40.10.125) via Prisma
export async function POST(req) {
  try {
    const formData = await req.formData();
    const description = (formData.get("description") || "").trim();
    const uploadedBy = (formData.get("uploadedBy") || "Member").trim();
    const file = formData.get("file");

    if (!description) {
      return NextResponse.json({ success: false, error: "Description is required." }, { status: 400 });
    }

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "A valid file is required." }, { status: 400 });
    }

    const mime = file.type || "";
    const isImage = mime.startsWith("image/");
    const isPdf = mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      return NextResponse.json(
        { success: false, error: "Only images (JPG, PNG, WEBP) and PDF files are allowed." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 500KB limit (with small tolerance up to 52,000 bytes)
    const MAX_BYTES = 520000;
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File size is ${formatBytes(buffer.length)}, which exceeds the 500 KB limit. Please compress the file before uploading.`,
        },
        { status: 400 }
      );
    }

    const inserted = await prisma.uploadedForms.create({
      data: {
        Description: description,
        FileName: file.name,
        FileType: isPdf ? "application/pdf" : (file.type || "image/jpeg"),
        FileSize: buffer.length,
        FileSizeFormatted: formatBytes(buffer.length),
        FileData: buffer,
        UploadedBy: uploadedBy,
      },
      select: {
        Id: true,
        Description: true,
        FileName: true,
        FileType: true,
        FileSize: true,
        FileSizeFormatted: true,
        UploadedBy: true,
        UploadedAt: true,
      },
    });

    const formEntry = {
      id: inserted.Id,
      description: inserted.Description,
      fileName: inserted.FileName,
      fileType: inserted.FileType,
      fileSize: inserted.FileSize,
      fileSizeFormatted: inserted.FileSizeFormatted,
      fileUrl: `/api/forms/file?id=${inserted.Id}`,
      downloadUrl: `/api/forms/file?id=${inserted.Id}&download=1`,
      uploadedBy: inserted.UploadedBy,
      uploadedAt: inserted.UploadedAt,
    };

    return NextResponse.json({ success: true, form: formEntry });
  } catch (err) {
    console.error("Error inserting form into ITForms DB via Prisma:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/forms?id=... -> Delete form from ITForms database via Prisma
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Form ID is required." }, { status: 400 });
    }

    try {
      await prisma.uploadedForms.delete({
        where: { Id: parseInt(id, 10) },
      });
    } catch (err) {
      // If record is already deleted or not found in DB (Prisma P2025), treat as success
      if (err.code !== "P2025") {
        throw err;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting form from ITForms DB via Prisma:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
