"use client";

import { useState } from "react";
import LogoutButton from "./LogoutButton";
import ServerRoomChecklist from "./ITTemparature/tempareture";
import UploadForms from "./UploadForms";
import ViewForms from "./ViewForms";

export default function DashboardClient({ empName }) {
  const [activeView, setActiveView] = useState("checklists"); // "checklists" | "upload-forms" | "view-forms"
  const [menuOpen, setMenuOpen] = useState(false);
  const [formsDropdownOpen, setFormsDropdownOpen] = useState(false);

  return (
    <div
      className="dashboard-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f2f2f2",
        color: "#333333",
      }}
    >
      {/* Fixed Navbar */}
      <nav
        className="no-print"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          height: "56px",
          boxSizing: "border-box",
          fontFamily: "Arial, sans-serif",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 20px",
          borderBottom: "1px solid #cccccc",
          backgroundColor: "#f8f9fa",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        {/* Left Side: Hamburger Trigger + Brand Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Hamburger Button (Hover or click to open full-height drawer) */}
          <button
            type="button"
            className="hamburger-btn"
            onMouseEnter={() => setMenuOpen(true)}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle Navigation Drawer"
            title="Open Menu"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "4px",
              width: "36px",
              height: "36px",
              padding: "6px",
              backgroundColor: menuOpen ? "#e2e8f0" : "transparent",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
          >
            <span style={{ width: "18px", height: "2px", backgroundColor: "#1e293b", borderRadius: "2px" }} />
            <span style={{ width: "18px", height: "2px", backgroundColor: "#1e293b", borderRadius: "2px" }} />
            <span style={{ width: "18px", height: "2px", backgroundColor: "#1e293b", borderRadius: "2px" }} />
          </button>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: "bold", fontSize: "16px" }}>IT Forms Management System</span>
          </div>
        </div>

        {/* Right Side: User Greeting & Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <span style={{ fontSize: "13px" }}>
            Hello, <strong>{empName}</strong>
          </span>
          <LogoutButton />
        </div>
      </nav>

      {/* Full Page Height Backdrop Overlay */}
      <div
        className="drawer-backdrop no-print"
        onClick={() => setMenuOpen(false)}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.28)",
          zIndex: 1999,
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Full Page Height Sidebar Drawer */}
      <aside
        className="drawer-sidebar no-print"
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "295px",
          height: "100vh",
          backgroundColor: "#ffffff",
          boxShadow: menuOpen ? "6px 0 28px rgba(0, 0, 0, 0.18)" : "none",
          borderRight: "1px solid #e2e8f0",
          zIndex: 2000,
          display: "flex",
          flexDirection: "column",
          transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
          boxSizing: "border-box",
        }}
      >
        {/* Drawer Header (aligned with navbar height) */}
        <div
          style={{
            height: "56px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>📑</span>
            <span style={{ fontWeight: "700", fontSize: "15px", color: "#0f172a" }}>IT Forms Menu</span>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              backgroundColor: "#ffffff",
              cursor: "pointer",
              fontSize: "14px",
              color: "#64748b",
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* 1st Item: Checklists */}
          <button
            type="button"
            onClick={() => {
              setActiveView("checklists");
              setMenuOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              width: "100%",
              padding: "11px 14px",
              textAlign: "left",
              backgroundColor: activeView === "checklists" ? "#f0f9ff" : "transparent",
              border: activeView === "checklists" ? "1px solid #bae6fd" : "1px solid #e2e8f0",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (activeView !== "checklists") e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              if (activeView !== "checklists") e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span style={{ fontSize: "18px", marginTop: "2px", flexShrink: 0 }}>📋</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: activeView === "checklists" ? "#0284c7" : "#1e293b",
                }}
              >
                Checklists
              </span>
              <span style={{ fontSize: "11.5px", color: "#64748b", lineHeight: 1.3 }}>
                Server Temperature, Maintenance &amp; Inspection
              </span>
            </div>
          </button>

          {/* 2nd Item: Forms (Dropdown with Upload Forms & View Forms) */}
          <div>
            <button
              type="button"
              onClick={() => setFormsDropdownOpen((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "11px 14px",
                textAlign: "left",
                backgroundColor: formsDropdownOpen ? "#f1f5f9" : "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: formsDropdownOpen ? "8px 8px 0 0" : "8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!formsDropdownOpen) e.currentTarget.style.backgroundColor = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (!formsDropdownOpen) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>📁</span>
                <span style={{ fontSize: "14.5px", fontWeight: "700", color: "#1e293b" }}>Forms</span>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  transform: formsDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                  display: "inline-block",
                }}
              >
                ▼
              </span>
            </button>

            {/* Dropdown items for Forms: Upload Forms, View Forms */}
            {formsDropdownOpen && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  padding: "8px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                }}
              >
                {/* 2a. Upload Forms */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveView("upload-forms");
                    setMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    width: "100%",
                    padding: "9px 12px",
                    textAlign: "left",
                    backgroundColor: activeView === "upload-forms" ? "#ffffff" : "transparent",
                    border: activeView === "upload-forms" ? "1px solid #bae6fd" : "1px solid transparent",
                    borderRadius: "6px",
                    cursor: "pointer",
                    boxShadow: activeView === "upload-forms" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (activeView !== "upload-forms") e.currentTarget.style.backgroundColor = "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    if (activeView !== "upload-forms") e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span style={{ fontSize: "16px", marginTop: "2px", flexShrink: 0 }}>📤</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span
                      style={{
                        fontSize: "13.5px",
                        fontWeight: activeView === "upload-forms" ? "700" : "600",
                        color: activeView === "upload-forms" ? "#0284c7" : "#1e293b",
                      }}
                    >
                      Upload Forms
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.3 }}>
                      Upload and compress forms (≤ 50 KB)
                    </span>
                  </div>
                </button>

                {/* 2b. View Forms */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveView("view-forms");
                    setMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    width: "100%",
                    padding: "9px 12px",
                    textAlign: "left",
                    backgroundColor: activeView === "view-forms" ? "#ffffff" : "transparent",
                    border: activeView === "view-forms" ? "1px solid #bae6fd" : "1px solid transparent",
                    borderRadius: "6px",
                    cursor: "pointer",
                    boxShadow: activeView === "view-forms" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (activeView !== "view-forms") e.currentTarget.style.backgroundColor = "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    if (activeView !== "view-forms") e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span style={{ fontSize: "16px", marginTop: "2px", flexShrink: 0 }}>👁️</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span
                      style={{
                        fontSize: "13.5px",
                        fontWeight: activeView === "view-forms" ? "700" : "600",
                        color: activeView === "view-forms" ? "#0284c7" : "#1e293b",
                      }}
                    >
                      View Forms
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.3 }}>
                      Browse, preview, and download forms
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            fontSize: "12px",
            color: "#64748b",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <span>Greentech Industries (India) Pvt. Ltd.</span>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>IT Department Management</span>
        </div>
      </aside>

      {/* Main Container */}
      <main className="dashboard-main" style={{ flex: 1, paddingTop: "56px" }}>
        <style>{`
          @media print {
            .dashboard-root { background-color: #ffffff !important; min-height: 0 !important; }
            .dashboard-main { padding-top: 0 !important; }
          }
        `}</style>

        {activeView === "checklists" && <ServerRoomChecklist />}

        {activeView === "upload-forms" && (
          <UploadForms
            onUploadSuccess={() => setActiveView("view-forms")}
            onCancel={() => setActiveView("checklists")}
            empName={empName}
          />
        )}

        {activeView === "view-forms" && (
          <ViewForms
            onUploadNew={() => setActiveView("upload-forms")}
            onBack={() => setActiveView("checklists")}
          />
        )}
      </main>
    </div>
  );
}
