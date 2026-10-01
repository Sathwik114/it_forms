/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { compressImageTo50Kb, formatFileSize } from "./compressImage";

export default function UploadForms({ onUploadSuccess, onCancel, empName = "Member" }) {
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [processedFile, setProcessedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [stats, setStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef(null);

  const resetSelection = () => {
    setSelectedFile(null);
    setProcessedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setStats(null);
    setErrorMsg("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");
    setSelectedFile(file);

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      setErrorMsg("Invalid file type. Only images (JPG, PNG, WEBP) and PDF files are allowed.");
      resetSelection();
      return;
    }

    if (isImage) {
      setIsCompressing(true);
      try {
        const result = await compressImageTo50Kb(file);
        setProcessedFile(result.file);
        setPreviewUrl(result.previewUrl);
        setStats({
          isImage: true,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          ratio: result.ratio,
        });
      } catch (err) {
        console.error("Compression error:", err);
        setErrorMsg("Failed to compress image. Please try another image file.");
      } finally {
        setIsCompressing(false);
      }
    } else if (isPdf) {
      const maxPdfBytes = 51200; // 50 KB
      if (file.size > maxPdfBytes) {
        setErrorMsg(
          `PDF size is ${formatFileSize(file.size)}, which exceeds the 50 KB limit. Please upload a PDF under 50 KB, or upload as a photo/image (images are automatically compressed to under 50 KB).`
        );
        setProcessedFile(null);
        setStats({
          isImage: false,
          originalSize: file.size,
          compressedSize: file.size,
          tooLarge: true,
        });
      } else {
        setProcessedFile(file);
        setStats({
          isImage: false,
          originalSize: file.size,
          compressedSize: file.size,
          tooLarge: false,
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!description.trim()) {
      setErrorMsg("Please enter a description for the form.");
      return;
    }

    if (!processedFile) {
      setErrorMsg("Please select and compress a valid image or PDF under 50 KB.");
      return;
    }

    if (processedFile.size > 52000) {
      setErrorMsg(`File size (${formatFileSize(processedFile.size)}) exceeds the 50 KB limit.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("description", description.trim());
      formData.append("uploadedBy", empName);
      formData.append("file", processedFile);

      const res = await fetch("/api/forms", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload form.");
      }

      setSuccessMsg("Form uploaded successfully!");
      setTimeout(() => {
        if (onUploadSuccess) onUploadSuccess(data.form);
      }, 700);
    } catch (err) {
      console.error("Upload error:", err);
      setErrorMsg(err.message || "An error occurred while uploading.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "680px", margin: "30px auto", padding: "0 16px" }}>
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>📤</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
                Upload Form
              </h2>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Images &amp; PDFs only • Automatically compressed to ≤ 50 KB
              </span>
            </div>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                fontSize: "13px",
                color: "#64748b",
                background: "transparent",
                border: "1px solid #cbd5e1",
                padding: "6px 12px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Error Message */}
          {errorMsg && (
            <div
              style={{
                padding: "12px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#b91c1c",
                fontSize: "13px",
                lineHeight: 1.4,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div
              style={{
                padding: "12px 14px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                color: "#15803d",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              ✅ {successMsg}
            </div>
          )}

          {/* Description Field */}
          <div>
            <label
              htmlFor="form-desc"
              style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}
            >
              Form Description / Title <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              id="form-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Server Room Access Log, Firewall Maintenance Signoff, etc."
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                fontSize: "14px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                outline: "none",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </div>

          {/* File Upload Box */}
          <div>
            <label
              htmlFor="form-file"
              style={{ display: "block", fontSize: "13.5px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}
            >
              Select Form File (Image or PDF) <span style={{ color: "#ef4444" }}>*</span>
            </label>

            <div
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: "10px",
                padding: "24px 16px",
                textAlign: "center",
                background: "#fafafa",
                cursor: "pointer",
                transition: "border-color 0.2s ease, background 0.2s ease",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                id="form-file"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf,.pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <div style={{ fontSize: "36px", marginBottom: "8px" }}>📄</div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b", marginBottom: "4px" }}>
                {selectedFile ? selectedFile.name : "Click to select an Image or PDF file"}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Accepted: JPG, PNG, WEBP, PDF • Target size: Under 50 KB
              </div>
            </div>
          </div>

          {/* Compression Indicator */}
          {isCompressing && (
            <div
              style={{
                padding: "12px 14px",
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color: "#0369a1",
              }}
            >
              <span>⏳</span>
              <span>Compressing image to under 50 KB...</span>
            </div>
          )}

          {/* Processed File Summary & Preview */}
          {stats && !isCompressing && (
            <div
              style={{
                padding: "14px",
                background: stats.tooLarge ? "#fef2f2" : "#f8fafc",
                border: stats.tooLarge ? "1px solid #fecaca" : "1px solid #e2e8f0",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                  File Size Summary:
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    background: stats.tooLarge ? "#fee2e2" : "#dcfce7",
                    color: stats.tooLarge ? "#991b1b" : "#166534",
                  }}
                >
                  {stats.tooLarge ? "❌ Exceeds 50 KB" : "✅ Under 50 KB Target"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "20px", fontSize: "12.5px", color: "#475569", flexWrap: "wrap" }}>
                <div>
                  Original: <strong>{formatFileSize(stats.originalSize)}</strong>
                </div>
                <div>
                  Resulting: <strong>{formatFileSize(stats.compressedSize)}</strong>
                </div>
                {stats.ratio > 0 && (
                  <div style={{ color: "#16a34a", fontWeight: "600" }}>
                    Reduced by {stats.ratio}%
                  </div>
                )}
              </div>

              {/* Preview Thumbnail for Image */}
              {previewUrl && (
                <div style={{ marginTop: "6px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>
                    Compressed Preview:
                  </div>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxHeight: "180px",
                      maxWidth: "100%",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                style={{
                  padding: "9px 18px",
                  fontSize: "13.5px",
                  fontWeight: "600",
                  color: "#475569",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isCompressing || !processedFile || (stats && stats.tooLarge)}
              style={{
                padding: "9px 24px",
                fontSize: "13.5px",
                fontWeight: "600",
                color: "#ffffff",
                background: isSubmitting || isCompressing || !processedFile || (stats && stats.tooLarge) ? "#94a3b8" : "#0284c7",
                border: "none",
                borderRadius: "6px",
                cursor: isSubmitting || isCompressing || !processedFile || (stats && stats.tooLarge) ? "not-allowed" : "pointer",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                transition: "background 0.15s ease",
              }}
            >
              {isSubmitting ? "Uploading..." : "Upload Form"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
