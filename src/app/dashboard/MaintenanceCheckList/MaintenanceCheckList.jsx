"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { downloadSheetAsExcel, downloadSheetAsPdf } from "../downloadPdf";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const FORM_OPTIONS = [
  { value: "main-temp", label: "Main Server Temperature", location: "Main Server Room", type: "temp" },
  { value: "backup-temp", label: "Backup Server Temperature", location: "Backup Server Room", type: "temp" },
  { value: "main-maint", label: "Main Server Maintenance", location: "Main Server Room", type: "maint" },
  { value: "backup-maint", label: "Backup Server Maintenance", location: "Backup Server Room", type: "maint" },
  { value: "server-inspection", label: "Server Inspection Checklist", location: "Main Server Room", type: "inspection" },
];

// Check columns (order and widths follow the paper form)
const CHECKS = [
  { key: "fileServer", label: "File Server Storage Light", width: "9%" },
  { key: "inforStatus", label: "Infor Status Check", width: "6.5%" },
  { key: "inforStorage", label: "Infor Server Storage Light", width: "9%" },
  { key: "backupStorage", label: "Backup Server Storage Light", width: "9%" },
  { key: "ups", label: "UPS", width: "6%" },
  { key: "modem", label: "Internet Modem Light", width: "8.5%" },
  { key: "pbx", label: "PBX/PRI Light", width: "8%" },
];

const TOTAL_COLS = 2 + CHECKS.length + 2; // Day, Date, checks, Signature, Remark

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const isoKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** ISO-8601 week of the year (Monday start, week 1 has the first Thursday). */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Weeks of a month (Monday start). Only real dates of the month are kept
 * (1 → last date). Sundays are skipped unless includeSunday is true.
 * Returns [{ weekNo, days: [Date|null x 7] }]
 */
function buildWeeks(year, month, includeSunday = false) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let current = null;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const slot = (date.getDay() + 6) % 7; // Mon = 0 … Sun = 6

    if (!current || slot === 0) {
      current = { days: Array(7).fill(null) };
      weeks.push(current);
    }
    if (slot <= 5 || includeSunday) current.days[slot] = date;
  }

  return weeks
    .filter((w) => w.days.some(Boolean))
    .map((w) => ({ weekNo: getISOWeek(w.days.find(Boolean)), days: w.days }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ServerRoomMaintenanceChecklist({
  selectedOption = "main-maint",
  onOptionChange,
  isActive = true,
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [internalOption, setInternalOption] = useState(selectedOption);
  const [includeSunday, setIncludeSunday] = useState(false);
  const [checkedBy, setCheckedBy] = useState("");
  const [entries, setEntries] = useState({});
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef(null); // { "Main Server Room|2026-09-01": { ups: "OK" } }

  const activeOption = onOptionChange ? selectedOption : internalOption;
  const handleSelectChange = (val) => {
    if (onOptionChange) {
      onOptionChange(val);
    } else {
      setInternalOption(val);
    }
  };

  const location =
    activeOption === "backup-maint" || activeOption === "backup-temp"
      ? "Backup Server Room"
      : "Main Server Room";

  const weeks = useMemo(
    () => buildWeeks(year, month, includeSunday),
    [year, month, includeSunday]
  );

  const years = useMemo(() => {
    const y = today.getFullYear();
    return Array.from({ length: 21 }, (_, i) => y - 10 + i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entries are stored per location so Main and Backup sheets stay separate
  const setField = (dateKey, field, value) => {
    const k = `${location}|${dateKey}`;
    setEntries((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), [field]: value } }));
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const locSlug = location.replace(/\s+/g, "_");
      await downloadSheetAsPdf(sheetRef.current, `${locSlug}_Maintenance_${MONTHS[month]}_${year}.pdf`, "portrait");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    const locSlug = location.replace(/\s+/g, "_");
    await downloadSheetAsExcel(sheetRef.current, `${locSlug}_Maintenance_${MONTHS[month]}_${year}.xlsx`, "portrait");
  };

  return (
    <div className="sm-wrap">
      {isActive && <style>{css}</style>}

      {/* Toolbar (hidden while printing) */}
      <div className="sm-toolbar no-print">
        <label>
          Form / Location
          <select value={activeOption} onChange={(e) => handleSelectChange(e.target.value)}>
            {FORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label>
          Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          Month
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={includeSunday}
            onChange={(e) => setIncludeSunday(e.target.checked)}
          />
          Include Sundays
        </label>
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" onClick={handleDownloadPdf} disabled={downloading} style={{ marginLeft: "auto" }}>
          {downloading ? "Downloading..." : "Download PDF"}
        </button>
        <button type="button" onClick={handleDownloadExcel}>
          Download Excel
        </button>
      </div>

      <div className="sm-sheet" ref={sheetRef}>
        <div className="sm-table-wrap">
          <table className="sm-table">
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              {CHECKS.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
              <col style={{ width: "10%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>

            <thead>
              <tr>
                <th colSpan={TOTAL_COLS} className="title">Server Room Maintenance and Checklist</th>
              </tr>
              <tr className="meta">
                <td colSpan={5} className="left"><b>Locations:</b> {location}</td>
                <td colSpan={3} className="left"><b>Month:</b> {MONTHS[month]} {year}</td>
                <td colSpan={TOTAL_COLS - 8} className="left">
                  <b>Checked By:</b>{" "}
                  <input
                    className="inline-input"
                    value={checkedBy}
                    onChange={(e) => setCheckedBy(e.target.value)}
                  />
                </td>
              </tr>
              <tr className="head">
                <th>Day</th>
                <th>Date</th>
                {CHECKS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Worked By<br />Signature</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {weeks.map((week) => (
                <Fragment key={`w${week.weekNo}`}>
                  <tr className="week-row">
                    <td colSpan={TOTAL_COLS}>Week {week.weekNo}</td>
                  </tr>

                  {week.days.map((date, idx) => {
                    if (!date) return null; // no rows for days outside this month
                    const key = isoKey(date);
                    const row = entries[`${location}|${key}`] || {};
                    return (
                      <tr key={key}>
                        <td className="left day">{DAY_NAMES[idx]}</td>
                        <td className="date">{fmtDate(date)}</td>
                        {CHECKS.map((c) => (
                          <td key={c.key}>
                            <input
                              value={row[c.key] ?? ""}
                              onChange={(e) => setField(key, c.key, e.target.value)}
                            />
                          </td>
                        ))}
                        <td>
                          <input
                            value={row.signature ?? ""}
                            onChange={(e) => setField(key, "signature", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={row.remark ?? ""}
                            onChange={(e) => setField(key, "remark", e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sm-footer">
          <span>Greentech Industries(India) Pvt. Ltd.</span>
          <span className="code">IT-016-1</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles (plain CSS – no Tailwind needed)                            */
/* ------------------------------------------------------------------ */

const css = `
html, body, .sm-wrap, .sm-sheet { scrollbar-width: none; -ms-overflow-style: none; }
html::-webkit-scrollbar, body::-webkit-scrollbar, .sm-wrap::-webkit-scrollbar, .sm-sheet::-webkit-scrollbar { display: none; width: 0; height: 0; }

.sm-wrap { box-sizing: border-box; width: 100%; font-family: "Times New Roman", Times, serif; color: #000; background: #f2f2f2; padding: 12px; min-height: 100vh; }
.sm-toolbar { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin: 0 0 12px; font-family: system-ui, sans-serif; font-size: 14px; }
.sm-toolbar label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
.sm-toolbar label.check { flex-direction: row; align-items: center; gap: 6px; padding-bottom: 8px; }
.sm-toolbar select { padding: 6px 10px; font-size: 14px; border: 1px solid #888; border-radius: 4px; background: #fff; min-width: 120px; }
.sm-toolbar button { padding: 7px 16px; font-size: 14px; border: 1px solid #222; background: #222; color: #fff; border-radius: 4px; cursor: pointer; }
.sm-toolbar button.secondary { background: #fff; color: #222; }

.sm-sheet { width: 100%; box-sizing: border-box; margin: 0; background: #fff; padding: 12px 12px 8px; box-shadow: 0 1px 4px rgba(0,0,0,.2); overflow-x: auto; }
.sm-table { width: 100%; min-width: 820px; border-collapse: collapse; table-layout: fixed; font-size: 12px; border: 2px solid #000; }
.sm-table th, .sm-table td { border: 1px solid #000; padding: 0; text-align: center; height: 22px; }
.sm-table th.title { font-size: 18px; padding: 5px; }
.sm-table tr.meta td { padding: 3px 4px; font-size: 11px; height: 20px; }
.sm-table td.left { text-align: left; padding-left: 3px; }
.sm-table tr.head th { background: #d9d9d9; font-size: 10.5px; padding: 3px 2px; line-height: 1.15; }
.sm-table tr.week-row td { background: #d9d9d9; font-weight: 700; text-align: left; padding-left: 3px; font-size: 11px; height: 20px; }
.sm-table td.day, .sm-table td.date { font-size: 11px; }

.sm-table input { width: 100%; height: 100%; box-sizing: border-box; border: 0; background: transparent; padding: 2px; font: inherit; text-align: center; outline: none; }
.sm-table input:focus { background: #eef5ff; }
.inline-input { width: 60% !important; text-align: left !important; border-bottom: 1px dotted #666 !important; }

.sm-footer { position: relative; display: flex; justify-content: center; align-items: center; padding: 24px 40px 4px; font-size: 11px; }
.sm-footer .code { position: absolute; right: 40px; }

@media print {
  .no-print { display: none !important; }
  html, body { margin: 0; padding: 0; }
  /* Fill the full A4 page height (297mm - 2 x 10mm margin, minus a small safety gap) */
  .sm-wrap { background: #fff; padding: 0; height: 275mm; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .sm-sheet { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; box-shadow: none; padding: 0; max-width: none; overflow: visible; }
  .sm-table-wrap { flex: 1 1 auto; min-height: 0; }
  .sm-table { height: 100%; min-width: 0; }
  .sm-footer { padding: 6px 40px 0; flex: 0 0 auto; }
  .sm-table tr.head th, .sm-table tr.week-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 10mm; }
}
`;