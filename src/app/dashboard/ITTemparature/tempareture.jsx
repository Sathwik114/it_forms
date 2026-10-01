"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { downloadSheetAsExcel, downloadSheetAsPdf } from "../downloadPdf";
import ServerRoomMaintenanceChecklist, {
  FORM_OPTIONS,
} from "../MaintenanceCheckList/MaintenanceCheckList";
import ServerInspectionChecklist from "../ServerInspection/ServerInspection";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Form shows Monday → Saturday; Sunday only appears if "Include Sundays" is ticked
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TIME_SLOTS = [
  { key: "t8", label: "08:30 AM" },
  { key: "t12", label: "1:00 PM" },
  { key: "t16", label: "04:30 PM" },
];

const TEMP_RANGE = [15, 30];
const HUM_RANGE = [40, 70];

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const isoKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Build the weeks of a month (Monday-start).
 * Returns: [ { weekNo: 1, days: [ Date|null x 6 (Mon..Sat) ] }, ... ]
 * - Days that belong to the previous/next month are null (blank row).
 * - Sundays are skipped; a week that has no Mon–Sat date in this month is dropped.
 */
function buildWeeks(year, month, includeSunday = false) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let current = null;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const jsDay = date.getDay(); // 0 = Sun
    const slot = (jsDay + 6) % 7; // Mon = 0 … Sun = 6

    // Start a new week on Monday, or for the very first day of the month
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

/**
 * ISO-8601 week number of the year (1–52, sometimes 53).
 * Weeks start on Monday; week 1 is the week containing the year's first Thursday.
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Mon = 1 … Sun = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // move to that week's Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

const outOfRange = (val, [min, max]) => {
  if (val === "" || val === undefined) return false;
  const n = Number(val);
  return Number.isNaN(n) || n < min || n > max;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ServerRoomChecklist() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedOption, setSelectedOption] = useState("main-temp");
  const [includeSunday, setIncludeSunday] = useState(false);
  const [checkedBy, setCheckedBy] = useState("");
  const [entries, setEntries] = useState({});
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef(null); // { "Main Server Room|2026-09-01": { t8_temp: "22", ... } }

  const isTemp =
    selectedOption === "main-temp" || selectedOption === "backup-temp";
  const isMaintenance =
    selectedOption === "main-maint" || selectedOption === "backup-maint";
  const isInspection = selectedOption === "server-inspection";
  const location =
    selectedOption === "backup-temp" || selectedOption === "backup-maint"
      ? "Backup Server Room"
      : "Main Server Room";

  const weeks = useMemo(() => buildWeeks(year, month, includeSunday), [year, month, includeSunday]);

  const years = useMemo(() => {
    const y = today.getFullYear();
    return Array.from({ length: 21 }, (_, i) => y - 10 + i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entries are stored per location so Main and Backup sheets stay separate
  const setField = (dateKey, field, value) => {
    const k = `${location}|${dateKey}`;
    setEntries((prev) => ({
      ...prev,
      [k]: { ...(prev[k] || {}), [field]: value },
    }));
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const locSlug = location.replace(/\s+/g, "_");
      await downloadSheetAsPdf(sheetRef.current, `${locSlug}_Temperature_${MONTHS[month]}_${year}.pdf`, "portrait");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    const locSlug = location.replace(/\s+/g, "_");
    await downloadSheetAsExcel(sheetRef.current, `${locSlug}_Temperature_${MONTHS[month]}_${year}.xlsx`, "portrait");
  };

  return (
    <>
      <div
        className={!isTemp ? "no-print" : ""}
        style={{ display: isTemp ? "block" : "none" }}
      >
        <div className="sr-wrap">
          {isTemp && <style>{css}</style>}

          {/* Toolbar (hidden while printing) */}
          <div className="sr-toolbar no-print">
            <label>
              Form / Location
              <select value={selectedOption} onChange={(e) => setSelectedOption(e.target.value)}>
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

          <div className="sr-sheet" ref={sheetRef}>
            <div className="sr-table-wrap">
            <table className="sr-table">
              <colgroup>
                <col style={{ width: "10.5%" }} />
                <col style={{ width: "10.5%" }} />
                <col style={{ width: "7.8%" }} />
                <col style={{ width: "7.8%" }} />
                <col style={{ width: "7.8%" }} />
                <col style={{ width: "7.8%" }} />
                <col style={{ width: "7.8%" }} />
                <col style={{ width: "7.8%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "19%" }} />
              </colgroup>

              <thead>
                <tr>
                  <th colSpan={10} className="title">Server Room Temperature/Humidity and Checklist</th>
                </tr>
                <tr className="meta">
                  <td colSpan={4} className="left"><b>Locations:</b> {location}</td>
                  <td colSpan={3} className="left">
                    <b>Month:</b> {MONTHS[month]} {year}
                  </td>
                  <td colSpan={3} className="left">
                    <b>Checked By:</b>{" "}
                    <input
                      className="inline-input"
                      value={checkedBy}
                      onChange={(e) => setCheckedBy(e.target.value)}
                    />
                  </td>
                </tr>
                <tr className="head">
                  <th rowSpan={2}>Day</th>
                  <th rowSpan={2}>Date</th>
                  {TIME_SLOTS.map((t) => (
                    <th key={t.key} colSpan={2}>Time: {t.label}</th>
                  ))}
                  <th rowSpan={2}>Worked By<br />Signature</th>
                  <th rowSpan={2}>Remarks</th>
                </tr>
                <tr className="head sub">
                  {TIME_SLOTS.map((t) => (
                    <Fragment key={t.key}>
                      <th>Temp<small>(15°C-30°C)</small></th>
                      <th>Humidity<small>(40%-70%)</small></th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {weeks.map((week) => (
                  <Fragment key={week.weekNo}>
                    <tr key={`w${week.weekNo}`} className="week-row">
                      <td colSpan={10}>Week {week.weekNo}</td>
                    </tr>

                    {week.days.map((date, idx) => {
                      if (!date) return null; // skip days outside this month (and Sundays when unchecked)
                      const key = isoKey(date);
                      const row = entries[`${location}|${key}`] || {};
                    return (
                        <tr key={key}>
                          <td className="left day">{DAY_NAMES[idx]}</td>
                          <td className="date">{fmtDate(date)}</td>

                          {TIME_SLOTS.map((t) => (
                            <Fragment key={t.key}>
                              <td>
                                <input
                                  type="number"
                                  step="0.1"
                                  className={outOfRange(row[`${t.key}_temp`], TEMP_RANGE) ? "bad" : ""}
                                  value={row[`${t.key}_temp`] ?? ""}
                                  onChange={(e) => setField(key, `${t.key}_temp`, e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.1"
                                  className={outOfRange(row[`${t.key}_hum`], HUM_RANGE) ? "bad" : ""}
                                  value={row[`${t.key}_hum`] ?? ""}
                                  onChange={(e) => setField(key, `${t.key}_hum`, e.target.value)}
                                />
                              </td>
                            </Fragment>
                          ))}

                          <td>
                            <input
                              value={row.signature ?? ""}
                              onChange={(e) => setField(key, "signature", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={row.remarks ?? ""}
                              onChange={(e) => setField(key, "remarks", e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}

                <tr className="note">
                  <td colSpan={10} className="left"><b>Note:</b> Reference No.GB2887-89 B-Category</td>
                </tr>
              </tbody>
            </table>
            </div>

            <div className="sr-footer">
              <span>Greentech Industries(India) Pvt. Ltd.</span>
              <span className="code">IT-015-1</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className={!isMaintenance ? "no-print" : ""}
        style={{ display: isMaintenance ? "block" : "none" }}
      >
        <ServerRoomMaintenanceChecklist
          selectedOption={selectedOption}
          onOptionChange={setSelectedOption}
          isActive={isMaintenance}
        />
      </div>

      <div
        className={!isInspection ? "no-print" : ""}
        style={{ display: isInspection ? "block" : "none" }}
      >
        <ServerInspectionChecklist
          selectedOption={selectedOption}
          onOptionChange={setSelectedOption}
          isActive={isInspection}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles (plain CSS – no Tailwind needed)                            */
/* ------------------------------------------------------------------ */

const css = `
html, body, .sr-wrap, .sr-sheet { scrollbar-width: none; -ms-overflow-style: none; }
html::-webkit-scrollbar, body::-webkit-scrollbar, .sr-wrap::-webkit-scrollbar, .sr-sheet::-webkit-scrollbar { display: none; width: 0; height: 0; }

.sr-wrap { box-sizing: border-box; width: 100%; font-family: "Times New Roman", Times, serif; color: #000; background: #f2f2f2; padding: 12px; min-height: 100vh; }
.sr-toolbar { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin: 0 0 12px; font-family: system-ui, sans-serif; font-size: 14px; }
.sr-toolbar label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
.sr-toolbar select { padding: 6px 10px; font-size: 14px; border: 1px solid #888; border-radius: 4px; background: #fff; min-width: 120px; }
.sr-toolbar label.check { flex-direction: row; align-items: center; gap: 6px; padding-bottom: 8px; }
.sr-toolbar button { padding: 7px 16px; font-size: 14px; border: 1px solid #222; background: #222; color: #fff; border-radius: 4px; cursor: pointer; }
.sr-toolbar button.secondary { background: #fff; color: #222; }

.sr-sheet { width: 100%; box-sizing: border-box; margin: 0; background: #fff; padding: 12px 12px 8px; box-shadow: 0 1px 4px rgba(0,0,0,.2); overflow-x: auto; }
.sr-table { width: 100%; min-width: 760px; border-collapse: collapse; table-layout: fixed; font-size: 12px; border: 2px solid #000; }
.sr-table th, .sr-table td { border: 1px solid #000; padding: 0; text-align: center; height: 22px; }
.sr-table th.title { font-size: 17px; padding: 4px; }
.sr-table tr.meta td { padding: 3px 4px; font-size: 11px; height: 20px; }
.sr-table td.left { text-align: left; padding-left: 3px; }
.sr-table tr.head th { background: #d9d9d9; font-size: 11px; padding: 2px; }
.sr-table tr.head.sub th { font-size: 10.5px; }
.sr-table th small { display: block; font-size: 8px; font-weight: 600; }
.sr-table tr.week-row td { background: #d9d9d9; font-weight: 700; text-align: left; padding-left: 3px; font-size: 11px; height: 20px; }
.sr-table td.day { font-size: 11px; }
.sr-table td.date { font-size: 11px; }
.sr-table tr.blank td { background: #fafafa; }
.sr-table tr.note td { padding: 4px 3px; font-size: 11px; }

.sr-table input { width: 100%; height: 100%; box-sizing: border-box; border: 0; background: transparent; padding: 2px; font: inherit; text-align: center; outline: none; }
.sr-table input:focus { background: #eef5ff; }
.sr-table input:disabled { cursor: not-allowed; }
.sr-table input.bad { background: #ffd6d6; color: #b00000; font-weight: 700; }
.sr-table input[type=number]::-webkit-inner-spin-button,
.sr-table input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.sr-table input[type=number] { -moz-appearance: textfield; }
.inline-input { width: 60% !important; text-align: left !important; border-bottom: 1px dotted #666 !important; }


.sr-footer { position: relative; display: flex; justify-content: center; align-items: center; padding: 24px 40px 4px; font-size: 11px; }
.sr-footer .code { position: absolute; right: 40px; }

@media print {
  .no-print { display: none !important; }
  .sr-wrap { background: #fff; padding: 0; min-height: 0; }
  html, body { margin: 0; padding: 0; }
  /* Fill the full A4 page height (297mm - 2 x 10mm margin, minus a small safety gap) */
  .sr-wrap { height: 275mm; display: flex; flex-direction: column; overflow: hidden; }
  .sr-sheet { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; box-shadow: none; padding: 0; max-width: none; overflow: visible; }
  .sr-table-wrap { flex: 1 1 auto; min-height: 0; }
  .sr-table { height: 100%; min-width: 0; }
  .sr-footer { padding: 6px 40px 0; flex: 0 0 auto; }
  .sr-table input.bad { background: #ffd6d6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sr-table tr.head th, .sr-table tr.week-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 10mm; }
}
`;