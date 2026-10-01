"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { downloadSheetAsExcel, downloadSheetAsPdf } from "../downloadPdf";
import { FORM_OPTIONS } from "../MaintenanceCheckList/MaintenanceCheckList";

// Rows are filled up to "Status". The inspection columns stay blank for handwriting.
const SERVERS = [
  { name: "SR550-01", type: "Host (Server)", brand: "Lenovo", usage: "FP10 Infor Server", status: "Active" },
  { name: "SR550-02", type: "Host (Server)", brand: "Lenovo", usage: "FP10 Infor Server", status: "Active" },
  { name: "SR550-03", type: "Host (Server)", brand: "Lenovo", usage: "VMWare Server", status: "Active" },
  { name: "X3650 M5-01", type: "Host (Server)", brand: "Lenovo", usage: "VMWare Server", status: "Active" },
  { name: "X3650 M5-02", type: "Host (Server)", brand: "Lenovo", usage: "VMWare Server", status: "Active" },
  { name: "V3700 V2-01", type: "System Storage", brand: "Lenovo", usage: "FP10 Infor Storage", status: "Active" },
  { name: "V3700 V2-02", type: "System Storage", brand: "Lenovo", usage: "VMWare Storage", status: "Active" },
  { name: "V3700 V2-02", type: "System Storage", brand: "Lenovo", usage: "VMWare Storage", status: "Repair" },
  { name: "X3850 M2-01", type: "Host (Server)", brand: "IBM", usage: "IT Web Server", status: "Active" },
  { name: "Power 740-01", type: "Host (Server)", brand: "IBM", usage: "FP5 Infor Server", status: "Active" },
  { name: "Power 740-02", type: "Host (Server)", brand: "IBM", usage: "FP5 Infor Server", status: "Repair" },
  { name: "DS5020-01", type: "System Storage", brand: "IBM", usage: "FP5 Infor Storage", status: "Active" },
  { name: "DS5300-01", type: "System Storage", brand: "IBM", usage: "FP5 Infor Storage", status: "Active" },
  { name: "EXP5000-01", type: "System Storage", brand: "IBM", usage: "FP5 Infor Extend Storage", status: "Active" },
  { name: "X3850 X5-01", type: "Host (Server)", brand: "IBM", usage: "Dns Server2", status: "Active" },
  { name: "X3850 X5-02", type: "Host (Server)", brand: "IBM", usage: "Backup File Server", status: "Active" },
  { name: "V5000-01", type: "Storwize", brand: "IBM", usage: "Backup File Server Storage", status: "Active" },
  { name: "Inspur-01", type: "System", brand: "Inspur", usage: "Main File Server", status: "Active" },
  { name: "Inspur-02", type: "System", brand: "Inspur", usage: "Backup File Server", status: "Repair" },
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
  2.8, 7.0, 8.2, 4.0, 9.2, 3.8,                    // S.No .. Status (Type is 8.2% so System Storage stays in single line)
  3.4, 3.4, 3.2, 3.4, 3.4, 3.8, 5.4, 3.2, 4.2, 4.4, 4.4, // Front LED .. Overall Status
  7.8, 8.3, 6.7,                                   // Remarks, Checked By, Date
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
  .chk-table tr.chk-meta td { background: #fff; height: 24px; font-weight: 700; text-align: left; padding-left: 4px; font-size: 12px; }

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
  const sheetRef = useRef(null);

  const setToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setDay(now.getDate());
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const max = new Date(year, m + 1, 0).getDate();
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

        <button type="button" className="secondary" onClick={setToday}>Today</button>
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
                {[...INFO_HEADS, ...CHECK_HEADS, ...END_HEADS].map((h) => (
                  <th key={h} scope="col" className={NOWRAP_HEADS.includes(h) ? "nowrap" : undefined}>
                    {h === "HDD/SSD" ? <>HDD/<wbr />SSD</> : h}
                  </th>
                ))}
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
                  <td>{s.status}</td>
                  {CHECK_HEADS.map((h) => (
                    <td key={h}></td>
                  ))}
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
    </div>
  );
}
