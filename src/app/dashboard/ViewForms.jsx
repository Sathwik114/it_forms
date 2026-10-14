/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 15;
const COL_LINE = "1px solid #e2e8f0";

export default function ViewForms({ onUploadNew, onBack }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateSortOrder, setDateSortOrder] = useState("desc"); // "desc" | "asc"

  const fetchForms = () => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let isMounted = true;
    fetch("/api/forms")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success) {
          setForms(data.forms || []);
          setErrorMsg("");
        } else {
          setErrorMsg(data.error || "Failed to load forms from database.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error loading forms from ITForms DB:", err);
        setErrorMsg(err.message || "Failed to fetch uploaded forms from database.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleDelete = async (id, description) => {
    if (!window.confirm(`Are you sure you want to delete "${description}" from the database?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/forms?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete form.");
      }
      setForms((prev) => prev.filter((f) => f.id !== id));
      if (previewItem?.id === id) {
        setPreviewItem(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.message || "Failed to delete form.");
    } finally {
      setDeletingId(null);
    }
  };

  // Dedicated Print handler for both PDF documents and images
  const handlePrint = (item) => {
    if (!item || !item.fileUrl) return;

    const isPdf = item.fileType === "application/pdf" || (item.fileName || "").toLowerCase().endsWith(".pdf");
    const fileUrl = item.fileUrl;

    const iframeId = "print-iframe-hidden";
    let iframe = document.getElementById(iframeId);
    if (iframe) {
      iframe.remove();
    }

    iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    if (isPdf) {
      iframe.src = fileUrl;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            const win = window.open(fileUrl, "_blank");
            win?.focus();
            win?.print();
          }
        }, 500);
      };
    } else {
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${item.description || item.fileName}</title>
              <style>
                @page { margin: 10mm; size: auto; }
                body {
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  background: #ffffff;
                }
                img {
                  max-width: 100%;
                  max-height: 98vh;
                  object-fit: contain;
                  display: block;
                }
              </style>
            </head>
            <body>
              <img src="${fileUrl}" onload="window.focus(); window.print();" />
            </body>
          </html>
        `);
        doc.close();
      } else {
        const win = window.open(fileUrl, "_blank");
        win?.focus();
        win?.print();
      }
    }
  };

  const filteredForms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result = q
      ? forms.filter(
          (f) =>
            (f.description || "").toLowerCase().includes(q) ||
            (f.fileName || "").toLowerCase().includes(q) ||
            (f.uploadedBy || "").toLowerCase().includes(q)
        )
      : [...forms];

    // Strictly sort by Date & Time (descending by default) with Id tiebreaker
    return result.sort((a, b) => {
      const timeA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const timeB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;

      if (dateSortOrder === "asc") {
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
      } else {
        // default: descending (newest date and time first)
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || 0) - (a.id || 0);
      }
    });
  }, [forms, searchQuery, dateSortOrder]);

  /* ---------- Pagination ---------- */
  const totalItems = filteredForms.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const showPagination = totalItems > PAGE_SIZE;

  // Always keep the page within range (e.g. after delete / search)
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedForms = filteredForms.slice(startIndex, endIndex);

  const goToPage = (p) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setCurrentPage(next);
  };

  // Builds [1, "...", 4, 5, 6, "...", 20]
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);
    if (left > 2) pages.push("left-dots");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("right-dots");
    pages.push(totalPages);
    return pages;
  }, [totalPages, safePage]);

  const pageBtnStyle = (active, disabled) => ({
    minWidth: "34px",
    height: "34px",
    padding: "0 10px",
    fontSize: "13px",
    fontWeight: "600",
    borderRadius: "6px",
    border: active ? "1px solid #0284c7" : "1px solid #cbd5e1",
    background: active ? "#0284c7" : "#ffffff",
    color: active ? "#ffffff" : disabled ? "#94a3b8" : "#334155",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  });

  const formatDate = (isoString) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: "16px 0", padding: "0 24px", boxSizing: "border-box" }}>
      {/* Top Bar - Full Width */}
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#ffffff",
          borderRadius: "10px",
          padding: "16px 24px",
          boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)",
          border: "1px solid #e2e8f0",
          marginBottom: "16px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "24px" }}>📋</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
                Uploaded Forms Directory
              </h1>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  background: "#e0f2fe",
                  color: "#0369a1",
                }}
              >
                {forms.length} {forms.length === 1 ? "Record" : "Records"}
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Fetched directly from ITForms Database (10.40.10.125)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="🔍 Search forms..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: "7px 12px",
              fontSize: "13px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              outline: "none",
              minWidth: "240px",
              backgroundColor: "#f8fafc",
            }}
          />

          {onUploadNew && (
            <button
              type="button"
              onClick={onUploadNew}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              }}
            >
              <span>➕</span>
              <span>Upload Form</span>
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#475569",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          )}

          <button
            type="button"
            onClick={fetchForms}
            disabled={loading}
            title="Refresh database records"
            style={{
              padding: "7px 10px",
              fontSize: "13px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div
          style={{
            padding: "12px 14px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            color: "#b91c1c",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Main Table Container - Full Width */}
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "1150px",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "12.5px",
              fontFamily: "Arial, sans-serif",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "2px solid #e2e8f0",
                  color: "#334155",
                  fontWeight: "700",
                }}
              >
                <th style={{ padding: "8px 10px", borderRight: COL_LINE, width: "50px", textAlign: "center", whiteSpace: "nowrap" }}>S.No</th>
                <th style={{ padding: "8px 14px", borderRight: COL_LINE, whiteSpace: "nowrap" }}>Description</th>
                <th style={{ padding: "8px 14px", borderRight: COL_LINE, whiteSpace: "nowrap" }}>File</th>
                <th style={{ padding: "8px 12px", borderRight: COL_LINE, width: "95px", textAlign: "center", whiteSpace: "nowrap" }}>Size</th>
                <th style={{ padding: "8px 14px", borderRight: COL_LINE, width: "150px", whiteSpace: "nowrap" }}>Uploaded By</th>
                <th
                  onClick={() => {
                    setDateSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRight: COL_LINE,
                    width: "185px",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  title={`Click to sort by Date & Time (Currently: ${dateSortOrder === "desc" ? "Descending / Newest first" : "Ascending / Oldest first"})`}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>Date &amp; Time</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor: dateSortOrder === "desc" ? "#e0f2fe" : "#f1f5f9",
                        color: dateSortOrder === "desc" ? "#0369a1" : "#475569",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                    >
                      {dateSortOrder === "desc" ? "▼ Newest" : "▲ Oldest"}
                    </span>
                  </div>
                </th>
                <th style={{ padding: "8px 14px", width: "250px", textAlign: "center", borderRight: "none", whiteSpace: "nowrap" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#64748b", whiteSpace: "nowrap" }}>
                    ⏳ Fetching forms from ITForms database...
                  </td>
                </tr>
              )}

              {!loading && filteredForms.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: "38px", marginBottom: "8px" }}>📭</div>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "#1e293b", marginBottom: "4px" }}>
                      {forms.length === 0 ? "No uploaded forms found in ITForms database" : "No matching forms found"}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "16px" }}>
                      {forms.length === 0
                        ? "Click below to upload your first form (under 500 KB)."
                        : `No records matched "${searchQuery}"`}
                    </div>
                    {forms.length === 0 && onUploadNew && (
                      <button
                        type="button"
                        onClick={onUploadNew}
                        style={{
                          padding: "8px 18px",
                          background: "#0284c7",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        ➕ Upload Form
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedForms.map((item, idx) => {
                  const isPdf = item.fileType === "application/pdf" || (item.fileName || "").toLowerCase().endsWith(".pdf");

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #cbd5e1",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                    >
                      {/* S.No - Single Line */}
                      <td style={{ padding: "6px 10px", borderRight: COL_LINE, textAlign: "center", color: "#64748b", fontWeight: "600", whiteSpace: "nowrap" }}>
                        {startIndex + idx + 1}
                      </td>

                      {/* Description - Strictly Single Line */}
                      <td style={{ padding: "6px 14px", borderRight: COL_LINE, fontWeight: "600", color: "#0f172a", whiteSpace: "nowrap" }}>
                        <div
                          title={item.description}
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "420px",
                            lineHeight: 1.3,
                          }}
                        >
                          {item.description}
                        </div>
                      </td>

                      {/* File - Strictly Single Line */}
                      <td style={{ padding: "6px 14px", borderRight: COL_LINE, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: "15px", flexShrink: 0 }}>{isPdf ? "📄" : "🖼️"}</span>
                          <span
                            onClick={() => setPreviewItem(item)}
                            title={`Click to view ${item.fileName}`}
                            style={{
                              color: "#0369a1",
                              fontWeight: "600",
                              cursor: "pointer",
                              textDecoration: "underline",
                              maxWidth: "280px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "inline-block",
                            }}
                          >
                            {item.fileName}
                          </span>
                        </div>
                      </td>

                      {/* Size - Single Line */}
                      <td style={{ padding: "6px 12px", borderRight: COL_LINE, textAlign: "center", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "#dcfce7",
                            color: "#166534",
                            whiteSpace: "nowrap",
                            display: "inline-block",
                          }}
                        >
                          {item.fileSizeFormatted}
                        </span>
                      </td>

                      {/* Uploaded By - Strictly Single Line */}
                      <td style={{ padding: "6px 14px", borderRight: COL_LINE, color: "#334155", fontWeight: "500", whiteSpace: "nowrap" }}>
                        {item.uploadedBy || "Member"}
                      </td>

                      {/* Date & Time - Strictly Single Line */}
                      <td style={{ padding: "6px 14px", borderRight: COL_LINE, color: "#64748b", whiteSpace: "nowrap" }}>
                        {formatDate(item.uploadedAt)}
                      </td>

                      {/* Actions - Single Line with View, Print, Download, Delete */}
                      <td style={{ padding: "6px 14px", textAlign: "center", borderRight: "none", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", whiteSpace: "nowrap" }}>
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#0369a1",
                              background: "#f0f9ff",
                              border: "1px solid #bae6fd",
                              borderRadius: "5px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                            title="Preview File"
                          >
                            👁️ View
                          </button>

                          {/* Print Button */}
                          <button
                            type="button"
                            onClick={() => handlePrint(item)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#334155",
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              borderRadius: "5px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                            title="Print File"
                          >
                            🖨️ Print
                          </button>

                          {/* Download Button */}
                          <a
                            href={item.downloadUrl || item.fileUrl}
                            download={item.fileName}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#166534",
                              background: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              borderRadius: "5px",
                              textDecoration: "none",
                              display: "inline-block",
                              whiteSpace: "nowrap",
                            }}
                            title="Download File"
                          >
                            ⬇️ Download
                          </a>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.description)}
                            disabled={deletingId === item.id}
                            style={{
                              padding: "4px 7px",
                              fontSize: "12px",
                              color: "#b91c1c",
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              borderRadius: "5px",
                              cursor: deletingId === item.id ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                            title="Delete Record"
                          >
                            {deletingId === item.id ? "..." : "🗑️"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && showPagination && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "12px 16px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <span style={{ fontSize: "12.5px", color: "#64748b" }}>
              Showing <strong style={{ color: "#0f172a" }}>{startIndex + 1}</strong> to{" "}
              <strong style={{ color: "#0f172a" }}>{endIndex}</strong> of{" "}
              <strong style={{ color: "#0f172a" }}>{totalItems}</strong> records
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={safePage === 1}
                title="First page"
                style={pageBtnStyle(false, safePage === 1)}
              >
                «
              </button>
              <button
                type="button"
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                style={pageBtnStyle(false, safePage === 1)}
              >
                ‹ Prev
              </button>

              {pageNumbers.map((p) =>
                typeof p === "number" ? (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    aria-current={p === safePage ? "page" : undefined}
                    style={pageBtnStyle(p === safePage, false)}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={p} style={{ padding: "0 4px", color: "#94a3b8", fontWeight: "700" }}>
                    …
                  </span>
                )
              )}

              <button
                type="button"
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                style={pageBtnStyle(false, safePage === totalPages)}
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => goToPage(totalPages)}
                disabled={safePage === totalPages}
                title="Last page"
                style={pageBtnStyle(false, safePage === totalPages)}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Preview */}
      {previewItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
          }}
          onClick={() => setPreviewItem(null)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              maxWidth: "1050px",
              width: "100%",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
                gap: "12px",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <h3 style={{ margin: 0, fontSize: "15px", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {previewItem.description}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
                  {previewItem.fileName} • {previewItem.fileSizeFormatted} • Uploaded by {previewItem.uploadedBy || "Member"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                {/* Print button in modal */}
                <button
                  type="button"
                  onClick={() => handlePrint(previewItem)}
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#334155",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Print Document"
                >
                  🖨️ Print
                </button>

                <a
                  href={previewItem.downloadUrl || previewItem.fileUrl}
                  download={previewItem.fileName}
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#0369a1",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Download File"
                >
                  ⬇️ Download
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f172a",
                minHeight: "450px",
              }}
            >
              {previewItem.fileType === "application/pdf" || (previewItem.fileName || "").toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewItem.fileUrl}
                  title={previewItem.description}
                  style={{
                    width: "100%",
                    height: "75vh",
                    border: "none",
                    borderRadius: "4px",
                    background: "#ffffff",
                  }}
                />
              ) : (
                <img
                  src={previewItem.fileUrl}
                  alt={previewItem.description}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "75vh",
                    objectFit: "contain",
                    borderRadius: "4px",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
