/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";

export default function ViewForms({ onUploadNew, onBack }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  const filteredForms = forms.filter((f) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (f.description || "").toLowerCase().includes(q) ||
      (f.fileName || "").toLowerCase().includes(q) ||
      (f.uploadedBy || "").toLowerCase().includes(q)
    );
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
    <div style={{ width: "100%", maxWidth: "1280px", margin: "20px auto", padding: "0 16px", boxSizing: "border-box" }}>
      {/* Top Bar */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "10px",
          padding: "16px 20px",
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
              Fetched directly from ITForms Database
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="🔍 Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "7px 12px",
              fontSize: "13px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              outline: "none",
              minWidth: "220px",
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

      {/* Main Table Container */}
      <div
        style={{
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
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "13px",
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
                <th style={{ padding: "12px 10px", width: "50px", textAlign: "center" }}>S.No</th>
                <th style={{ padding: "12px 14px" }}>Description</th>
                <th style={{ padding: "12px 14px" }}>File</th>
                <th style={{ padding: "12px 12px", width: "90px", textAlign: "center" }}>Size</th>
                <th style={{ padding: "12px 14px", width: "130px" }}>Uploaded By</th>
                <th style={{ padding: "12px 14px", width: "170px" }}>Date &amp; Time</th>
                <th style={{ padding: "12px 14px", width: "190px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
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
                        ? "Click below to upload your first form (under 50 KB)."
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
                filteredForms.map((item, idx) => {
                  const isPdf = item.fileType === "application/pdf" || (item.fileName || "").toLowerCase().endsWith(".pdf");

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                    >
                      {/* S.No */}
                      <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748b", fontWeight: "600" }}>
                        {idx + 1}
                      </td>

                      {/* Description */}
                      <td style={{ padding: "12px 14px", fontWeight: "600", color: "#0f172a", maxWidth: "300px" }}>
                        <div style={{ lineHeight: 1.35 }}>{item.description}</div>
                      </td>

                      {/* File */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "18px" }}>{isPdf ? "📄" : "🖼️"}</span>
                          <span
                            onClick={() => setPreviewItem(item)}
                            title="Click to view file"
                            style={{
                              color: "#0369a1",
                              fontWeight: "600",
                              cursor: "pointer",
                              textDecoration: "underline",
                              maxWidth: "220px",
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

                      {/* Size */}
                      <td style={{ padding: "12px 12px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "#dcfce7",
                            color: "#166534",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.fileSizeFormatted}
                        </span>
                      </td>

                      {/* Uploaded By */}
                      <td style={{ padding: "12px 14px", color: "#334155", fontWeight: "500" }}>
                        {item.uploadedBy || "Member"}
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: "12px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                        {formatDate(item.uploadedAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            style={{
                              padding: "5px 9px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#0369a1",
                              background: "#f0f9ff",
                              border: "1px solid #bae6fd",
                              borderRadius: "5px",
                              cursor: "pointer",
                            }}
                            title="Preview File"
                          >
                            👁️ View
                          </button>

                          <a
                            href={item.downloadUrl || item.fileUrl}
                            download={item.fileName}
                            style={{
                              padding: "5px 9px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#166534",
                              background: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              borderRadius: "5px",
                              textDecoration: "none",
                              display: "inline-block",
                            }}
                            title="Download File"
                          >
                            ⬇️ Download
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.description)}
                            disabled={deletingId === item.id}
                            style={{
                              padding: "5px 8px",
                              fontSize: "12px",
                              color: "#b91c1c",
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              borderRadius: "5px",
                              cursor: deletingId === item.id ? "not-allowed" : "pointer",
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
              maxWidth: "850px",
              width: "100%",
              maxHeight: "90vh",
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
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", color: "#0f172a" }}>
                  {previewItem.description}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {previewItem.fileName} • {previewItem.fileSizeFormatted} • Uploaded by {previewItem.uploadedBy || "Member"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                  }}
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
                minHeight: "360px",
              }}
            >
              {previewItem.fileType === "application/pdf" || (previewItem.fileName || "").toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewItem.fileUrl}
                  title={previewItem.description}
                  style={{
                    width: "100%",
                    height: "70vh",
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
