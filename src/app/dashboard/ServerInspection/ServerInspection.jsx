"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { downloadSheetAsExcel, downloadSheetAsPdf } from "../downloadPdf";
import { FORM_OPTIONS } from "../MaintenanceCheckList/MaintenanceCheckList";

// Rows are filled up to "Status". The inspection columns stay blank for handwriting.
const SERVERS = [
  { name: "V3700 V2-01", type: "System Storage", brand: "Lenovo", usage: "FP10 Infor Storage", status: "Active" },
  { name: "V3700 V2-02", type: "System Storage", brand: "Lenovo", usage: "VMWare Storage", status: "Active" },
  { name: "X3650 M5-01", type: "Host (Server)", brand: "Lenovo", usage: "VMWare Server", status: "Active" },
  { name: "X3650 M5-02", type: "Host (Server)", brand: "Lenovo", usage: "VMWare Server", status: "Active" },
  { name: "SR550-01", type: "Host (Server)", brand: "Lenovo", usage: "FP10 Infor Server", status: "Active" },
  { name: "Inspur-01", type: "System", brand: "Inspur", usage: "Main File Server", status: "Active" },
  { name: "DS5300-01", type: "System Storage", brand: "IBM", usage: "FP5 Infor Storage", status: "Active" },
  { name: "EXP5000-01", type: "System Storage", brand: "IBM", usage: "FP5 Infor Extend Storage", status: "Active" },
  { name: "X3850 M2-01", type: "Host (Server)", brand: "IBM", usage: "IT Web Server", status: "Active" },
  { name: "V3700 V2-02", type: "System Storage", brand: "Lenovo", usage: "VMWare Storage", status: "Inactive" },
  { name: "SR550-02", type: "Host (Server)", brand: "Lenovo", usage: "FP10 Infor Server", status: "Active" },
  { name: "SR550-03", type: "Host (Server)", brand: "Lenovo", usage: "VMWare Server", status: "Active" },
  { name: "Power 740-01", type: "Host (Server)", brand: "IBM", usage: "FP5 Infor Server", status: "Active" },
  { name: "Power 740-02", type: "Host (Server)", brand: "IBM", usage: "FP5 Infor Server", status: "Inactive" },
  { name: "DS5020-01", type: "System Storage", brand: "IBM", usage: "FP5 Infor Storage", status: "Active" },
  { name: "X3850 X5-01", type: "Host (Server)", brand: "IBM", usage: "Dns Server2", status: "Active" },
  { name: "X3850 X5-02", type: "Host (Server)", brand: "IBM", usage: "Backup File Server", status: "Active" },
  { name: "V5000-01", type: "Storwize", brand: "IBM", usage: "Backup File Server Storage", status: "Active" },
  { name: "Inspur-02", type: "System", brand: "Inspur", usage: "Backup File Server", status: "Inactive" },
];

const INFO_HEADS = ["S.No", "Server / Device", "Type", "Brand", "Usage", "Status"];
const CHECK_HEADS = [
  "Front LED", "Rear LED", "Fan", "PSU-1", "PSU-2", "HDD/SSD",
  "Battery / Capacitor", "FC", "Network", "Alarms", "Overall Status",
];
const END_HEADS = ["Remarks", "Checked By", "Date"];
const TOTAL_COLS = INFO_HEADS.length + CHECK_HEADS.length + END_HEADS.length;

// Column widths (% of table). Total = 100.
const COL_WIDTHS = [
  2.8, 7.0, 8.2, 4.0, 9.0, 5.2,                    // S.No .. Status (Type is 8.2%, Status is 5.2% so Active & Repair fit without cut off)
  3.4, 3.4, 3.2, 3.4, 3.4, 3.8, 5.4, 3.2, 4.2, 4.4, 4.4, // Front LED .. Overall Status
  7.2, 7.7, 6.7,                                   // Remarks, Checked By, Date
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Only single-word headers stay on one line. Everything else wraps to fill the column width.
const NOWRAP_HEADS = ["Network", "Alarms"];

const pad = (n) => String(n).padStart(2, "0");

const css = `
  .chk-page { box-sizing: border-box; width: 100%; font-family: "Times New Roman", Times, serif; color: #000; background: #f2f2f2; padding: 12px; min-height: calc(100vh - 56px); display: flex; flex-direction: column; }
  .chk-toolbar { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 12px; font-family: system-ui, sans-serif; font-size: 14px; }
  .chk-toolbar label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
  .chk-toolbar select { padding: 6px 10px; font-size: 14px; border: 1px solid #888; border-radius: 4px; background: #fff; min-width: 90px; }
  .chk-toolbar button { padding: 7px 16px; font-size: 14px; border: 1px solid #222; background: #222; color: #fff; border-radius: 4px; cursor: pointer; }
  .chk-toolbar button.secondary { background: #fff; color: #222; }
  .chk-sheet { width: 100%; flex: 1 1 auto; box-sizing: border-box; background: #fff; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.2); display: flex; flex-direction: column; }
  .chk-scroll { width: 100%; overflow-x: auto; }
  .chk-title { text-align: center; font-size: 22px; font-weight: 700; margin: 0 0 8px; flex: 0 0 auto; }
  .chk-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; border: 2px solid #000; }
  .chk-table th, .chk-table td { border: 1px solid #000; padding: 1px 3px; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: break-word; line-height: 1.15; }
  .chk-table thead tr.chk-heads th { background: #d9d9d9; font-weight: 700; height: 30px; font-size: 12px; }
  .chk-table thead tr.chk-heads th { padding: 1px; }
  .chk-table tbody td { height: 38px; font-size: 13px; }
  .chk-table .nowrap { white-space: nowrap; padding-left: 1px; padding-right: 1px; }
  .chk-table td.left { text-align: left; padding-left: 4px; }
  .chk-table input { width: 100%; height: 100%; box-sizing: border-box; border: 0; background: transparent; padding: 0 1px; font: inherit; font-size: 11px; text-align: center; outline: none; }
  .chk-table input:focus { background: #eef5ff; }
  .status-print { display: none; }
  .status-input { display: block; width: 100%; height: 100%; }
  .chk-table tr.chk-meta td { background: #fff; height: 24px; font-weight: 700; text-align: left; padding-left: 4px; font-size: 12px; }

  /* Excel-like selection styling for inspection cells */
  .chk-cell {
    cursor: cell;
    user-select: none;
    -webkit-user-select: none;
    transition: background-color 0.1s ease;
    text-align: center;
    vertical-align: middle;
    padding: 1px 2px !important;
  }
  .chk-cell:hover {
    background-color: #f1f5f9;
  }
  .chk-cell.selected-cell {
    background-color: #bfdbfe !important;
    box-shadow: inset 0 0 0 2px #2563eb !important;
  }
  .chk-val {
    font-size: 11px;
    font-weight: 700;
    color: #000;
    line-height: 1.1;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chk-val.val-ok { color: #15803d; }
  .chk-val.val-repair { color: #b91c1c; }
  .chk-table th.chk-selectable-head {
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s ease;
  }
  .chk-table th.chk-selectable-head:hover {
    background-color: #bfdbfe !important;
    color: #1e3a8a;
  }

  /* Popup Modal Styles */
  .chk-popup-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }
  .chk-popup-card {
    background: #ffffff;
    border-radius: 10px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    border: 1px solid #cbd5e1;
    padding: 18px 22px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .chk-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 10px;
  }
  .chk-badge-count {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 9999px;
    background: #e0f2fe;
    color: #0369a1;
  }
  .chk-presets-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chk-popup-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    font-size: 13.5px;
    font-weight: 600;
    border: 1.5px solid #0284c7;
    border-radius: 6px;
    outline: none;
    background: #f8fafc;
  }
  .chk-popup-input:focus {
    background: #ffffff;
    box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2);
  }
  .chk-popup-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
  }
  .chk-btn-more {
    font-size: 12px;
    font-weight: 600;
    color: #0369a1;
    background: #f0f9ff;
    border: 1px dashed #7dd3fc;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
  }
  .chk-btn-cancel {
    font-size: 12.5px;
    font-weight: 600;
    color: #475569;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 7px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  .chk-btn-apply {
    font-size: 12.5px;
    font-weight: 700;
    color: #ffffff;
    background: #0284c7;
    border: none;
    padding: 7px 18px;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
  .chk-btn-apply:hover {
    background: #0369a1;
  }

  .chk-footer { text-align: center; font-size: 13px; font-weight: 700; margin-top: 10px; }

  @page { size: A4 landscape; margin: 5mm; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; width: 100% !important; }
    .chk-toolbar { display: none !important; }
    .chk-page { background: #fff !important; padding: 0 !important; width: 100% !important; min-height: 0 !important; display: block !important; }
    .chk-sheet { padding: 0 !important; box-shadow: none !important; width: 100% !important; display: block !important; }
    .chk-scroll { width: 100% !important; overflow: visible !important; }
    .chk-table { width: 100% !important; font-size: 9.5px; }
    .chk-table thead tr.chk-heads th { font-size: 10.5px !important; }
    .chk-table tbody td { height: 8.7mm !important; font-size: 11px !important; }
    .chk-table input, .status-input { display: none !important; }
    .status-print { display: block !important; font-size: 11px !important; text-align: center !important; }
    .chk-cell { cursor: default !important; }
    .chk-cell.selected-cell { background-color: transparent !important; box-shadow: none !important; }
    .chk-popup-overlay { display: none !important; }
    .chk-table tr { break-inside: avoid; }
    .chk-footer { font-size: 11px; margin-top: 4mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export default function ServerInspectionChecklist({
  selectedOption = "server-inspection",
  onOptionChange,
  isActive = true,
}) {
  // Set on the client after mount so server and client HTML always match.
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null); // 0-11
  const [day, setDay] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [statuses, setStatuses] = useState(() => SERVERS.map((s) => s.status));

  // Inspection check boxes state: key = `${rowIdx}_${colIdx}`
  const [checkValues, setCheckValues] = useState({});
  const [selectedCells, setSelectedCells] = useState(() => new Set());
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [fillValue, setFillValue] = useState("OK");

  const isSelectingRef = useRef(false);
  const startCellRef = useRef({ row: 0, col: 0 });
  const baseSelectionRef = useRef(new Set());
  const popupInputRef = useRef(null);

  // Global mouseup listener to open popup on left-click release after selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        setSelectedCells((current) => {
          if (current.size > 0) {
            setIsPopupOpen(true);
          }
          return current;
        });
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Autofocus input in popup
  useEffect(() => {
    if (isPopupOpen) {
      const timer = setTimeout(() => {
        if (popupInputRef.current) {
          popupInputRef.current.focus();
          popupInputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isPopupOpen]);

  const handleCellMouseDown = (row, col, e) => {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
  
    const key = `${row}_${col}`;
    isSelectingRef.current = true;
    startCellRef.current = { row, col };

    if (e.ctrlKey || e.metaKey) {
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        baseSelectionRef.current = next;
        return next;
      });
    } else {
      const next = new Set([key]);
      baseSelectionRef.current = new Set();
      setSelectedCells(next);
    }
  };

  const handleCellMouseEnter = (row, col) => {
    if (!isSelectingRef.current) return;

    const minRow = Math.min(startCellRef.current.row, row);
    const maxRow = Math.max(startCellRef.current.row, row);
    const minCol = Math.min(startCellRef.current.col, col);
    const maxCol = Math.max(startCellRef.current.col, col);

    const next = new Set(baseSelectionRef.current);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        next.add(`${r}_${c}`);
      }
    }
    setSelectedCells(next);
  };

  const handleApplyFill = (valueToApply = fillValue) => {
    const val = (valueToApply ?? "").trim();
    setCheckValues((prev) => {
      const next = { ...prev };
      selectedCells.forEach((key) => {
        if (val) {
          next[key] = val;
        } else {
          delete next[key];
        }
      });
      return next;
    });
    setIsPopupOpen(false);
    setSelectedCells(new Set());
  };

  const handleCancelPopup = () => {
    setIsPopupOpen(false);
    setSelectedCells(new Set());
  };

  const handleSelectMore = () => {
    setIsPopupOpen(false);
  };

  const handleSelectColumn = (colIdx) => {
    const next = new Set();
    for (let r = 0; r < SERVERS.length; r++) {
      next.add(`${r}_${colIdx}`);
    }
    setSelectedCells(next);
    setIsPopupOpen(true);
  };

  const handleFillAllOk = () => {
    const next = {};
    for (let r = 0; r < SERVERS.length; r++) {
      for (let c = 0; c < CHECK_HEADS.length; c++) {
        next[`${r}_${c}`] = "OK";
      }
    }
    setCheckValues(next);
  };

  const handleReset = () => {
    const count = Object.keys(checkValues).length;
    if (count > 0 || statuses.some((st, i) => st !== SERVERS[i].status)) {
      if (!window.confirm("Are you sure you want to reset all checklist values, server statuses, and date to original form?")) {
        return;
      }
    }
    setCheckValues({});
    setStatuses(SERVERS.map((s) => s.status));
    setToday();
    setSelectedCells(new Set());
    setIsPopupOpen(false);
  };

  const handleStatusChange = (index, value) => {
    setStatuses((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };
  const sheetRef = useRef(null);

  const setToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setDay(now.getDate());
  };

  useEffect(setToday, []);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 21 }, (_, i) => y - 10 + i);
  }, []);

  const handleYearChange = (e) => {
    const y = Number(e.target.value);
    const max = new Date(y, (month ?? 0) + 1, 0).getDate();
    setYear(y);
    if (day > max) setDay(max);
  };

  const daysInMonth = useMemo(
    () => (year === null ? 31 : new Date(year, month + 1, 0).getDate()),
    [year, month]
  );

  const handleMonthChange = (e) => {
    const m = Number(e.target.value);
    const y = year ?? new Date().getFullYear();
    const max = new Date(y, m + 1, 0).getDate();
    setMonth(m);
    if (day > max) setDay(max); // e.g. 31 Jan -> Feb
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const suffix = year === null ? "Checklist" : `${year}-${pad(month + 1)}-${pad(day)}`;
      await downloadSheetAsPdf(sheetRef.current, `Server_Inspection_${suffix}.pdf`, "landscape");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    const suffix = year === null ? "Checklist" : `${year}-${pad(month + 1)}-${pad(day)}`;
    await downloadSheetAsExcel(sheetRef.current, `Server_Inspection_${suffix}.xlsx`, "landscape");
  };

  const dateText =
    year === null ? "" : `${pad(day)}/${pad(month + 1)}/${year}`;

  return (
    <div className="chk-page">
      {isActive && <style>{css}</style>}

      <div className="chk-toolbar no-print">
        <label>
          Form / Location
          <select
            value={selectedOption}
            onChange={(e) => onOptionChange && onOptionChange(e.target.value)}
          >
            {FORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label>
          Year
          <select value={year ?? ""} onChange={handleYearChange} disabled={year === null}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>

        <label>
          Month
          <select value={month ?? ""} onChange={handleMonthChange} disabled={year === null}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        </label>

        <label>
          Date
          <select
            value={day ?? ""}
            onChange={(e) => setDay(Number(e.target.value))}
            disabled={year === null}
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="secondary"
          onClick={handleFillAllOk}
          title="Quickly fill all inspection boxes with 'OK'"
        >
          ⚡ Fill All &quot;OK&quot;
        </button>
        <button
          type="button"
          className="secondary"
          onClick={handleReset}
          style={{
            borderColor: "#ef4444",
            color: "#b91c1c",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          title="Reset all inspection check values and server statuses to original form"
        >
          🔄 Reset Form
        </button>
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" onClick={handleDownloadPdf} disabled={downloading} style={{ marginLeft: "auto" }}>
          {downloading ? "Downloading..." : "Download PDF"}
        </button>
        <button type="button" onClick={handleDownloadExcel}>
          Download Excel
        </button>
      </div>

      <div className="chk-sheet" ref={sheetRef}>
        <h1 className="chk-title">IT Servers Inspection Checklist Form</h1>

        <div className="chk-scroll">
          <table className="chk-table">
            <colgroup>
              {COL_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: `${w}%` }} />
              ))}
            </colgroup>

            <thead>
              <tr className="chk-meta">
                <td colSpan={6}>Location: Main Server Room</td>
                <td colSpan={8}>Updated Date:</td>
                <td colSpan={TOTAL_COLS - 14}>Leader Sign:</td>
              </tr>
              <tr className="chk-heads">
                {[...INFO_HEADS, ...CHECK_HEADS, ...END_HEADS].map((h, idx) => {
                  const checkColIdx = idx - INFO_HEADS.length;
                  const isCheckCol = checkColIdx >= 0 && checkColIdx < CHECK_HEADS.length;
                  return (
                    <th
                      key={h}
                      scope="col"
                      className={`${NOWRAP_HEADS.includes(h) ? "nowrap" : ""} ${isCheckCol ? "chk-selectable-head" : ""}`}
                      onClick={isCheckCol ? () => handleSelectColumn(checkColIdx) : undefined}
                      title={isCheckCol ? `Click to select and fill all 19 servers for ${h}` : undefined}
                    >
                      {h === "HDD/SSD" ? <>HDD/<wbr />SSD</> : h}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {SERVERS.map((s, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td className="left nowrap">{s.name}</td>
                  <td className="left nowrap">{s.type}</td>
                  <td>{s.brand}</td>
                  <td className="left">{s.usage}</td>
                  <td className="status-cell">
                    <span className="status-print">{statuses[i] ?? s.status}</span>
                    <input
                      type="text"
                      className="status-input no-print"
                      value={statuses[i] ?? s.status}
                      onChange={(e) => handleStatusChange(i, e.target.value)}
                    />
                  </td>
                  {CHECK_HEADS.map((h, colIdx) => {
                    const key = `${i}_${colIdx}`;
                    const val = checkValues[key] || "";
                    const isSelected = selectedCells.has(key);
                    const valLower = val.toLowerCase();
                    return (
                      <td
                        key={h}
                        className={`chk-cell ${isSelected ? "selected-cell" : ""}`}
                        onMouseDown={(e) => handleCellMouseDown(i, colIdx, e)}
                        onMouseEnter={() => handleCellMouseEnter(i, colIdx)}
                        title={`Server ${s.name} - ${h}: ${val || "Empty (Ctrl+Click / Drag to select & fill)"}`}
                      >
                        <span className={`chk-val ${valLower === "ok" || valLower === "✓" ? "val-ok" : valLower === "repair" || valLower === "fault" ? "val-repair" : ""}`}>
                          {val}
                        </span>
                      </td>
                    );
                  })}
                  <td></td>
                  <td></td>
                  <td className="nowrap">{dateText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="chk-footer">Greentech Industries(India) Pvt. Ltd.</div>
      </div>

      {/* Excel-style Multi-Cell Fill Popup */}
      {isPopupOpen && (
        <div
          className="chk-popup-overlay"
          onClick={handleCancelPopup}
        >
          <div
            className="chk-popup-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chk-popup-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>📋</span>
                <span style={{ fontWeight: "700", fontSize: "16px", color: "#0f172a" }}>
                  Fill Inspection Boxes
                </span>
              </div>
              <span className="chk-badge-count">
                {selectedCells.size} {selectedCells.size === 1 ? "box" : "boxes"} selected
              </span>
            </div>

            <p style={{ margin: "8px 0 12px", fontSize: "12.5px", color: "#64748b" }}>
              Enter a value or click a quick preset to fit into the selected boxes:
            </p>

            {/* Quick Presets */}
            <div className="chk-presets-row">
              {[
                { label: "OK", color: "#166534", bg: "#dcfce7", border: "#bbf7d0" },
                { label: "✓", color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
                { label: "Normal", color: "#0369a1", bg: "#e0f2fe", border: "#bae6fd" },
                { label: "Good", color: "#334155", bg: "#f1f5f9", border: "#cbd5e1" },
                { label: "Active", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
                { label: "Repair", color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
                { label: "Fault", color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5" },
                { label: "N/A", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
                { label: "Clear", color: "#dc2626", bg: "#fff1f2", border: "#fecdd3" },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    if (p.label === "Clear") {
                      handleApplyFill("");
                    } else {
                      setFillValue(p.label);
                      handleApplyFill(p.label);
                    }
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: "600",
                    borderRadius: "5px",
                    cursor: "pointer",
                    color: p.color,
                    background: p.bg,
                    border: `1px solid ${p.border}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyFill();
              }}
              style={{ marginTop: "14px" }}
            >
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>
                Field Value:
              </label>
              <input
                ref={popupInputRef}
                type="text"
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                placeholder="Type value (e.g. OK, Normal, N/A)..."
                className="chk-popup-input"
              />

              <div className="chk-popup-actions">
                <button
                  type="button"
                  onClick={handleSelectMore}
                  className="chk-btn-more"
                  title="Keep selection and select more cells on the table"
                >
                  ➕ Select More
                </button>
                <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                  <button
                    type="button"
                    onClick={handleCancelPopup}
                    className="chk-btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="chk-btn-apply"
                  >
                    OK (Fill)
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
