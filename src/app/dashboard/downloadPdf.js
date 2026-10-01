// Vector PDF and styled Excel (.xlsx) generator for IT Forms
// (Temperature, Maintenance, Server Inspection)

const PT_TO_MM = 0.352778;

function tokenizeForWrap(trimmed) {
  const rawWords = trimmed.split(/\s+/);
  const tokens = [];
  for (const w of rawWords) {
    if (w.includes("/") && w.length > 4 && !/^\d{2}\/\d{2}\/\d{4}$/.test(w)) {
      const parts = w.split("/");
      for (let i = 0; i < parts.length; i++) {
        tokens.push(i < parts.length - 1 ? parts[i] + "/" : parts[i]);
      }
    } else {
      tokens.push(w);
    }
  }
  return tokens;
}

/**
 * Split text into lines that fit within maxW (mm), breaking only at spaces or after '/'.
 * Never breaks inside a word.
 */
function wrapWords(pdf, text, maxW) {
  const rawParagraphs = String(text || "").split(/\n/);
  const lines = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const tokens = tokenizeForWrap(trimmed);

    let current = "";
    for (const tok of tokens) {
      if (!current) {
        current = tok;
      } else {
        const joiner = current.endsWith("/") ? "" : " ";
        const candidate = current + joiner + tok;
        if (pdf.getTextWidth(candidate) <= maxW) {
          current = candidate;
        } else {
          lines.push(current);
          current = tok;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

/**
 * Draw vertically & horizontally aligned multi-line text inside a cell box.
 */
function drawCellLines(pdf, lines, x, y, w, h, {
  fontSizePt = 9,
  fontStyle = "normal",
  align = "center",
  padX = 1.2,
  color = [0, 0, 0],
} = {}) {
  const nonEmpty = lines.filter((l) => l !== "");
  if (nonEmpty.length === 0) return;

  pdf.setFont("times", fontStyle);
  pdf.setFontSize(fontSizePt);
  pdf.setTextColor(color[0], color[1], color[2]);

  const fontMm = fontSizePt * PT_TO_MM;
  const capH = fontMm * 0.68;
  const lineGap = fontMm * 1.15;
  const totalBlockH = (lines.length - 1) * lineGap + capH;
  const firstBaselineY = y + (h - totalBlockH) / 2 + capH;

  lines.forEach((line, idx) => {
    if (!line) return;
    const ly = firstBaselineY + idx * lineGap;
    if (align === "left") {
      pdf.text(line, x + padX, ly);
    } else if (align === "right") {
      pdf.text(line, x + w - padX, ly, { align: "right" });
    } else {
      pdf.text(line, x + w / 2, ly, { align: "center" });
    }
  });
}

/**
 * Extract clean text from a cell, converting <br> and <wbr> appropriately.
 */
function getCellTextWithBreaks(cell) {
  const input = cell.querySelector("input");
  if (input && !cell.querySelector("b")) {
    return (input.value || "").trim();
  }
  const clone = cell.cloneNode(true);
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  clone.querySelectorAll("wbr").forEach((wbr) => wbr.remove());
  return (clone.textContent || "").replace(/[ \t]+/g, " ").trim();
}

export async function downloadSheetAsPdf(sheetEl, filename, orientation = "portrait") {
  if (!sheetEl) return;

  const { jsPDF } = await import("jspdf");
  const isLandscape = orientation === "landscape";

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageW = pdf.internal.pageSize.getWidth();   // 297 (landscape) or 210 (portrait)
  const pageH = pdf.internal.pageSize.getHeight();  // 210 (landscape) or 297 (portrait)

  const marginX = isLandscape ? 5.5 : 10;
  const marginTop = isLandscape ? 6 : 10;
  const marginBottom = isLandscape ? 5.5 : 10;

  const contentW = pageW - marginX * 2;
  let cursorY = marginTop;

  // 1. Optional standalone title above table (e.g. .chk-title in ServerInspection)
  const topTitleEl = sheetEl.querySelector(".chk-title");
  if (topTitleEl) {
    const titleText = (topTitleEl.textContent || "").trim();
    pdf.setFont("times", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text(titleText, pageW / 2, cursorY + 4.2, { align: "center" });
    cursorY += 7.5;
  }

  // 2. Reserve space for footer at bottom
  const footerEl = sheetEl.querySelector(".sr-footer, .sm-footer, .chk-footer");
  const footerH = footerEl ? 5.5 : 0;
  const tableTop = cursorY;
  const tableH = pageH - marginBottom - footerH - tableTop;

  // 3. Parse table structure (colgroup, rows, rowSpan, colSpan)
  const tableEl = sheetEl.querySelector("table");
  if (!tableEl) return;

  const colEls = Array.from(tableEl.querySelectorAll("colgroup col"));
  let colPercents = colEls.map((c) => parseFloat(c.style.width) || 0);

  // Determine total column count
  let numCols = colPercents.length;
  const trEls = Array.from(tableEl.querySelectorAll("tr"));
  if (!numCols) {
    for (const tr of trEls) {
      let count = 0;
      Array.from(tr.children).forEach((td) => {
        count += Number(td.getAttribute("colspan") || 1);
      });
      if (count > numCols) numCols = count;
    }
    colPercents = Array(numCols).fill(100 / (numCols || 1));
  }

  // For Server Inspection (20 cols), Type = 8.2% so "System Storage" stays in a single line
  if (isLandscape && numCols === 20) {
    colPercents = [
      2.8, 7.0, 8.2, 4.0, 9.2, 4.2, // S.No, Server/Device, Type, Brand, Usage, Status (4.2% for typing)
      3.4, 3.4, 3.2, 3.4, 3.4, 3.8, 5.4, 3.2, 4.2, 4.4, 4.4, // 11 inspection cols
      7.4, 8.3, 6.7, // Remarks, Checked By, Date // Remarks, Checked By, Date
    ];
  }

  const totalPct = colPercents.reduce((a, b) => a + b, 0) || 100;
  const colWidths = colPercents.map((p) => (p / totalPct) * contentW);
  const colX = [];
  let accX = marginX;
  for (let c = 0; c < numCols; c++) {
    colX.push(accX);
    accX += colWidths[c];
  }

  // Classify rows and assign relative height weights
  const numRows = trEls.length;
  const rowWeights = trEls.map((tr) => {
    if (tr.querySelector("th.title")) return 1.45;
    if (tr.classList.contains("meta") || tr.classList.contains("chk-meta")) return isLandscape ? 0.85 : 1.05;
    if (tr.classList.contains("chk-heads")) return 1.18;
    if (tr.classList.contains("head") && tr.classList.contains("sub")) return 1.05;
    if (tr.classList.contains("head")) {
      const hasSubHead = tableEl.querySelector("tr.head.sub") !== null;
      return hasSubHead ? 1.0 : 1.55;
    }
    if (tr.classList.contains("week-row")) return 0.88;
    if (tr.classList.contains("note")) return 1.05;
    return 1.0;
  });

  const totalWeight = rowWeights.reduce((a, b) => a + b, 0) || 1;
  const rowHeights = rowWeights.map((w) => (w / totalWeight) * tableH);
  const rowY = [];
  let accY = tableTop;
  for (let r = 0; r < numRows; r++) {
    rowY.push(accY);
    accY += rowHeights[r];
  }

  // Build 2D occupancy grid for rowSpan & colSpan
  const occupied = Array.from({ length: numRows }, () => Array(numCols).fill(false));
  const cells = [];

  for (let r = 0; r < numRows; r++) {
    const tr = trEls[r];
    const domCells = Array.from(tr.children);
    let cCursor = 0;

    for (const cellEl of domCells) {
      while (cCursor < numCols && occupied[r][cCursor]) {
        cCursor++;
      }
      if (cCursor >= numCols) break;

      const rs = Math.min(numRows - r, Number(cellEl.getAttribute("rowspan") || 1));
      const cs = Math.min(numCols - cCursor, Number(cellEl.getAttribute("colspan") || 1));

      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          occupied[r + dr][cCursor + dc] = true;
        }
      }

      const x = colX[cCursor];
      const y = rowY[r];
      let w = 0;
      for (let dc = 0; dc < cs; dc++) w += colWidths[cCursor + dc];
      let h = 0;
      for (let dr = 0; dr < rs; dr++) h += rowHeights[r + dr];

      cells.push({ tr, cellEl, r, c: cCursor, rs, cs, x, y, w, h });
      cCursor += cs;
    }
  }

  // 4. Draw cells (background fill + inner borders + content)
  pdf.setLineWidth(0.22);
  pdf.setDrawColor(0, 0, 0);

  for (const item of cells) {
    const { tr, cellEl, x, y, w, h } = item;
    const isTitleCell = cellEl.classList.contains("title");
    const isMetaRow = tr.classList.contains("meta") || tr.classList.contains("chk-meta");
    const isHeadRow = tr.classList.contains("head") || tr.classList.contains("chk-heads");
    const isSubHead = tr.classList.contains("sub");
    const isWeekRow = tr.classList.contains("week-row");
    const isNoteRow = tr.classList.contains("note");
    const badInput = cellEl.querySelector("input.bad");

    // Fill color
    if (isHeadRow || isWeekRow) {
      pdf.setFillColor(217, 217, 217);
      pdf.rect(x, y, w, h, "FD");
    } else if (badInput) {
      pdf.setFillColor(255, 214, 214);
      pdf.rect(x, y, w, h, "FD");
    } else {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(x, y, w, h, "FD");
    }

    // Special Case A: Title row inside thead (Temperature & Maintenance forms)
    if (isTitleCell) {
      const text = getCellTextWithBreaks(cellEl);
      drawCellLines(pdf, [text], x, y, w, h, {
        fontSizePt: 13.5,
        fontStyle: "bold",
        align: "center",
      });
      continue;
    }

    // Special Case B: Meta row with <b>Label:</b> value (or Checked By input)
    if (isMetaRow) {
      const bEl = cellEl.querySelector("b");
      const inputEl = cellEl.querySelector("input");
      const fontSizePt = isLandscape ? 9 : 8.8;
      const fontMm = fontSizePt * PT_TO_MM;
      const capH = fontMm * 0.68;
      const baselineY = y + (h - capH) / 2 + capH;
      const startX = x + 1.5;

      if (bEl) {
        const labelText = (bEl.textContent || "").trim() + " ";
        pdf.setFont("times", "bold");
        pdf.setFontSize(fontSizePt);
        pdf.setTextColor(0, 0, 0);
        pdf.text(labelText, startX, baselineY);
        const labelW = pdf.getTextWidth(labelText);

        let valText = "";
        if (inputEl) {
          valText = (inputEl.value || "").trim();
        } else {
          const clone = cellEl.cloneNode(true);
          const cb = clone.querySelector("b");
          if (cb) cb.remove();
          valText = (clone.textContent || "").trim();
        }

        pdf.setFont("times", "normal");
        if (valText) {
          pdf.text(valText, startX + labelW, baselineY);
        }

        // Draw dotted line for inline-input ("Checked By:")
        if (inputEl && inputEl.classList.contains("inline-input")) {
          const lineStartX = startX + labelW;
          const lineEndX = x + w - 2.5;
          if (lineEndX > lineStartX) {
            pdf.setLineWidth(0.18);
            pdf.setDrawColor(100, 100, 100);
            pdf.setLineDashPattern([0.4, 0.6], 0);
            pdf.line(lineStartX, baselineY + 0.7, lineEndX, baselineY + 0.7);
            pdf.setLineDashPattern([], 0);
            pdf.setLineWidth(0.22);
            pdf.setDrawColor(0, 0, 0);
          }
        }
      } else {
        // e.g. ServerInspection tr.chk-meta ("Location: Main Server Room", "Updated Date:", "Leader Sign:")
        const text = getCellTextWithBreaks(cellEl);
        drawCellLines(pdf, [text], x, y, w, h, {
          fontSizePt,
          fontStyle: "bold",
          align: "left",
          padX: 1.5,
        });
      }
      continue;
    }

    // Special Case C: Sub-header with <small> (e.g. Temp (15°C-30°C))
    const smallEl = cellEl.querySelector("small");
    if (isSubHead && smallEl) {
      const smallText = (smallEl.textContent || "").trim();
      const clone = cellEl.cloneNode(true);
      const cs = clone.querySelector("small");
      if (cs) cs.remove();
      const mainText = (clone.textContent || "").trim();

      const mainPt = 8.2;
      const smallPt = 6.2;
      const mainMm = mainPt * PT_TO_MM;
      const smallMm = smallPt * PT_TO_MM;
      const mainCap = mainMm * 0.68;
      const smallCap = smallMm * 0.68;
      const gap = 1.1;
      const totalH = mainCap + gap + smallCap;
      const firstY = y + (h - totalH) / 2 + mainCap;
      const secondY = firstY + gap + smallCap;

      pdf.setFont("times", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(mainPt);
      pdf.text(mainText, x + w / 2, firstY, { align: "center" });
      pdf.setFontSize(smallPt);
      pdf.text(smallText, x + w / 2, secondY, { align: "center" });
      continue;
    }

    // Special Case D: Note row at bottom of Temperature table
    if (isNoteRow) {
      const bEl = cellEl.querySelector("b");
      const fontSizePt = 8.5;
      const fontMm = fontSizePt * PT_TO_MM;
      const capH = fontMm * 0.68;
      const baselineY = y + (h - capH) / 2 + capH;
      const startX = x + 1.5;

      if (bEl) {
        const labelText = (bEl.textContent || "").trim() + " ";
        const clone = cellEl.cloneNode(true);
        const cb = clone.querySelector("b");
        if (cb) cb.remove();
        const restText = (clone.textContent || "").trim();

        pdf.setFont("times", "bold");
        pdf.setFontSize(fontSizePt);
        pdf.setTextColor(0, 0, 0);
        pdf.text(labelText, startX, baselineY);
        const labelW = pdf.getTextWidth(labelText);
        pdf.setFont("times", "normal");
        pdf.text(restText, startX + labelW, baselineY);
      } else {
        drawCellLines(pdf, [getCellTextWithBreaks(cellEl)], x, y, w, h, {
          fontSizePt,
          fontStyle: "normal",
          align: "left",
          padX: 1.5,
        });
      }
      continue;
    }

    // Special Case E: Week header row
    if (isWeekRow) {
      drawCellLines(pdf, [getCellTextWithBreaks(cellEl)], x, y, w, h, {
        fontSizePt: 8.5,
        fontStyle: "bold",
        align: "left",
        padX: 1.5,
      });
      continue;
    }

    // Standard header (th) or body cell (td)
    const rawText = getCellTextWithBreaks(cellEl);
    if (!rawText) continue;

    const isBold = isHeadRow || Boolean(badInput);
    const fontStyle = isBold ? "bold" : "normal";
    const isLeft = cellEl.classList.contains("left");
    const align = isLeft ? "left" : "center";
    const padX = isLeft ? 1.2 : 0.8;
    const availW = Math.max(2, w - padX * 2);

    let fontSizePt = isHeadRow
      ? isLandscape ? 8.4 : 8.2
      : isLandscape ? 8.6 : 8.5;

    pdf.setFont("times", fontStyle);
    pdf.setFontSize(fontSizePt);

    // Ensure no single token overflows availW by stepping down font size slightly if needed
    const tokens = tokenizeForWrap(rawText);
    while (fontSizePt > 6.5) {
      pdf.setFontSize(fontSizePt);
      const widestToken = Math.max(...tokens.map((t) => pdf.getTextWidth(t)));
      if (widestToken <= availW) break;
      fontSizePt -= 0.3;
    }

    let lines = wrapWords(pdf, rawText, availW);

    // Keep multi-word headers to at most 3 lines when possible
    if (isHeadRow && lines.length > 3) {
      let tryPt = fontSizePt;
      while (tryPt > 7.2 && lines.length > 3) {
        tryPt -= 0.25;
        pdf.setFontSize(tryPt);
        const candidateLines = wrapWords(pdf, rawText, availW);
        if (candidateLines.length <= 3) {
          fontSizePt = tryPt;
          lines = candidateLines;
          break;
        }
      }
      pdf.setFontSize(fontSizePt);
    }

    // For body cells in Landscape Server Inspection (except Usage which may wrap at spaces if long),
    // keep short values (e.g. "System Storage", "Host (Server)") on 1 line
    if (!isHeadRow && isLandscape && lines.length > 1 && rawText.length <= 16) {
      let tryPt = fontSizePt;
      while (tryPt > 7.5) {
        tryPt -= 0.25;
        pdf.setFontSize(tryPt);
        if (pdf.getTextWidth(rawText) <= availW) {
          fontSizePt = tryPt;
          lines.length = 0;
          lines.push(rawText);
          break;
        }
      }
      pdf.setFontSize(fontSizePt);
    }

    drawCellLines(pdf, lines, x, y, w, h, {
      fontSizePt,
      fontStyle,
      align,
      padX,
      color: badInput ? [176, 0, 0] : [0, 0, 0],
    });
  }

  // 5. Draw crisp outer table border (2px equivalent = 0.55mm)
  pdf.setLineWidth(0.55);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(marginX, tableTop, contentW, tableH, "S");

  // 6. Draw footer below table
  if (footerEl) {
    const codeEl = footerEl.querySelector(".code");
    const codeText = codeEl ? (codeEl.textContent || "").trim() : "";
    const clone = footerEl.cloneNode(true);
    const cc = clone.querySelector(".code");
    if (cc) cc.remove();
    const centerText = (clone.textContent || "").trim();

    const footerY = tableTop + tableH + footerH - 1.2;
    pdf.setFont("times", isLandscape ? "bold" : "normal");
    pdf.setFontSize(isLandscape ? 9.5 : 8.5);
    pdf.setTextColor(0, 0, 0);

    if (centerText) {
      pdf.text(centerText, pageW / 2, footerY, { align: "center" });
    }
    if (codeText) {
      pdf.text(codeText, pageW - marginX - 10, footerY, { align: "right" });
    }
  }

  pdf.save(filename);
}

// --- EXCEL EXPORT (.xlsx OpenXML with full borders, fills, merges, and print setup) ---

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colIndexToLetter(colIdx) {
  let n = colIdx + 1;
  let str = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

function cellRef(r0, c0) {
  return `${colIndexToLetter(c0)}${r0 + 1}`;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(files) {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = typeof f.content === "string" ? encoder.encode(f.content) : f.content;
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  let localSize = 0;
  let centralSize = 0;
  for (const e of entries) {
    localSize += 30 + e.nameBytes.length + e.dataBytes.length;
    centralSize += 46 + e.nameBytes.length;
  }
  const totalSize = localSize + centralSize + 22;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  let offset = 0;
  for (const e of entries) {
    e.localOffset = offset;
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, 0x21, true);
    view.setUint32(offset + 14, e.crc, true);
    view.setUint32(offset + 18, e.dataBytes.length, true);
    view.setUint32(offset + 22, e.dataBytes.length, true);
    view.setUint16(offset + 26, e.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true);
    buf.set(e.nameBytes, offset + 30);
    buf.set(e.dataBytes, offset + 30 + e.nameBytes.length);
    offset += 30 + e.nameBytes.length + e.dataBytes.length;
  }

  const centralStart = offset;
  for (const e of entries) {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, 0, true);
    view.setUint16(offset + 14, 0x21, true);
    view.setUint32(offset + 16, e.crc, true);
    view.setUint32(offset + 20, e.dataBytes.length, true);
    view.setUint32(offset + 24, e.dataBytes.length, true);
    view.setUint16(offset + 28, e.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, e.localOffset, true);
    buf.set(e.nameBytes, offset + 46);
    offset += 46 + e.nameBytes.length;
  }

  const centralLength = offset - centralStart;
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, centralLength, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);

  return buf;
}

function getExcelCellText(cellEl) {
  const bEl = cellEl.querySelector("b");
  const inputEl = cellEl.querySelector("input");
  const smallEl = cellEl.querySelector("small");

  if (smallEl) {
    const smallText = (smallEl.textContent || "").trim();
    const clone = cellEl.cloneNode(true);
    const cs = clone.querySelector("small");
    if (cs) cs.remove();
    const mainText = (clone.textContent || "").trim();
    return `${mainText}\n${smallText}`;
  }

  if (bEl) {
    const labelText = (bEl.textContent || "").trim();
    let valText = "";
    if (inputEl) {
      valText = (inputEl.value || "").trim();
    } else {
      const clone = cellEl.cloneNode(true);
      const cb = clone.querySelector("b");
      if (cb) cb.remove();
      valText = (clone.textContent || "").trim();
    }
    return valText ? `${labelText} ${valText}` : `${labelText} `;
  }

  return getCellTextWithBreaks(cellEl);
}

export async function downloadSheetAsExcel(sheetEl, filename, orientation = "portrait") {
  if (!sheetEl) return;

  const isLandscape = orientation === "landscape";
  const tableEl = sheetEl.querySelector("table");
  if (!tableEl) return;

  const colEls = Array.from(tableEl.querySelectorAll("colgroup col"));
  let colPercents = colEls.map((c) => parseFloat(c.style.width) || 0);
  const trEls = Array.from(tableEl.querySelectorAll("tr"));

  let numCols = colPercents.length;
  if (!numCols) {
    for (const tr of trEls) {
      let count = 0;
      Array.from(tr.children).forEach((td) => {
        count += Number(td.getAttribute("colspan") || 1);
      });
      if (count > numCols) numCols = count;
    }
    colPercents = Array(numCols).fill(100 / (numCols || 1));
  }

  if (isLandscape && numCols === 20) {
    colPercents = [
      2.8, 7.0, 8.2, 4.0, 9.2, 4.2, // S.No, Server/Device, Type, Brand, Usage, Status (4.2% for typing)
      3.4, 3.4, 3.2, 3.4, 3.4, 3.8, 5.4, 3.2, 4.2, 4.4, 4.4, // 11 inspection cols
      7.4, 8.3, 6.7, // Remarks, Checked By, Date // Remarks, Checked By, Date
    ];
  }

  const totalPct = colPercents.reduce((a, b) => a + b, 0) || 100;
  const totalCharWidth = isLandscape ? 195 : 125;
  const colCharWidths = colPercents.map((p) => Math.max(5.5, Number(((p / totalPct) * totalCharWidth).toFixed(2))));

  const topTitleEl = sheetEl.querySelector(".chk-title");
  const footerEl = sheetEl.querySelector(".sr-footer, .sm-footer, .chk-footer");

  const gridRows = [];
  const rowHeightsPt = [];
  const merges = [];

  let rowOffset = 0;
  if (topTitleEl) {
    const titleText = (topTitleEl.textContent || "").trim();
    const row = Array.from({ length: numCols }, (_, c) => ({
      v: c === 0 ? titleText : "",
      s: 2,
    }));
    gridRows.push(row);
    rowHeightsPt.push(28);
    if (numCols > 1) {
      merges.push(`${cellRef(0, 0)}:${cellRef(0, numCols - 1)}`);
    }
    rowOffset = 1;
  }

  const numTableRows = trEls.length;
  const occupied = Array.from({ length: numTableRows }, () => Array(numCols).fill(false));
  for (let r = 0; r < numTableRows; r++) {
    gridRows.push(Array.from({ length: numCols }, () => ({ v: "", s: 6 })));
    const tr = trEls[r];
    if (tr.querySelector("th.title")) rowHeightsPt.push(26);
    else if (tr.classList.contains("meta") || tr.classList.contains("chk-meta")) rowHeightsPt.push(20);
    else if (tr.classList.contains("chk-heads")) rowHeightsPt.push(28);
    else if (tr.classList.contains("head") && tr.classList.contains("sub")) rowHeightsPt.push(24);
    else if (tr.classList.contains("head")) {
      const hasSub = tableEl.querySelector("tr.head.sub") !== null;
      rowHeightsPt.push(hasSub ? 20 : 32);
    } else if (tr.classList.contains("week-row")) rowHeightsPt.push(18);
    else if (tr.classList.contains("note")) rowHeightsPt.push(20);
    else rowHeightsPt.push(isLandscape ? 22 : 19);
  }

  for (let r = 0; r < numTableRows; r++) {
    const tr = trEls[r];
    const domCells = Array.from(tr.children);
    let cCursor = 0;

    for (const cellEl of domCells) {
      while (cCursor < numCols && occupied[r][cCursor]) {
        cCursor++;
      }
      if (cCursor >= numCols) break;

      const rs = Math.min(numTableRows - r, Number(cellEl.getAttribute("rowspan") || 1));
      const cs = Math.min(numCols - cCursor, Number(cellEl.getAttribute("colspan") || 1));

      const isTitleCell = cellEl.classList.contains("title");
      const isMetaRow = tr.classList.contains("meta") || tr.classList.contains("chk-meta");
      const isHeadRow = tr.classList.contains("head") || tr.classList.contains("chk-heads");
      const isWeekRow = tr.classList.contains("week-row");
      const isNoteRow = tr.classList.contains("note");
      const badInput = cellEl.querySelector("input.bad");
      const isLeft = cellEl.classList.contains("left");

      let styleIdx = 6;
      if (isTitleCell) styleIdx = 1;
      else if (isMetaRow) styleIdx = 3;
      else if (isHeadRow) styleIdx = 4;
      else if (isWeekRow) styleIdx = 5;
      else if (isNoteRow) styleIdx = 9;
      else if (badInput) styleIdx = 8;
      else if (isLeft) styleIdx = 7;

      const textVal = getExcelCellText(cellEl);

      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          occupied[r + dr][cCursor + dc] = true;
          gridRows[rowOffset + r + dr][cCursor + dc] = {
            v: dr === 0 && dc === 0 ? textVal : "",
            s: styleIdx,
          };
        }
      }

      if (rs > 1 || cs > 1) {
        const startRef = cellRef(rowOffset + r, cCursor);
        const endRef = cellRef(rowOffset + r + rs - 1, cCursor + cs - 1);
        merges.push(`${startRef}:${endRef}`);
      }

      cCursor += cs;
    }
  }

  if (footerEl) {
    const codeEl = footerEl.querySelector(".code");
    const codeText = codeEl ? (codeEl.textContent || "").trim() : "";
    const clone = footerEl.cloneNode(true);
    const cc = clone.querySelector(".code");
    if (cc) cc.remove();
    const centerText = (clone.textContent || "").trim();

    const fRowIdx = gridRows.length;
    const fRow = Array.from({ length: numCols }, () => ({ v: "", s: 0 }));

    if (codeText && numCols >= 4) {
      fRow[0] = { v: centerText, s: 10 };
      fRow[numCols - 2] = { v: codeText, s: 11 };
      merges.push(`${cellRef(fRowIdx, 0)}:${cellRef(fRowIdx, numCols - 3)}`);
      merges.push(`${cellRef(fRowIdx, numCols - 2)}:${cellRef(fRowIdx, numCols - 1)}`);
    } else {
      fRow[0] = { v: centerText, s: 10 };
      if (numCols > 1) {
        merges.push(`${cellRef(fRowIdx, 0)}:${cellRef(fRowIdx, numCols - 1)}`);
      }
    }
    gridRows.push(fRow);
    rowHeightsPt.push(20);
  }

  const colsXml = colCharWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");

  const rowsXml = gridRows
    .map((row, rIdx) => {
      const ht = rowHeightsPt[rIdx] || 20;
      const cellsXml = row
        .map((cell, cIdx) => {
          const ref = cellRef(rIdx, cIdx);
          const val = cell.v ?? "";
          if (val === "") {
            return `<c r="${ref}" s="${cell.s}"/>`;
          }
          return `<c r="${ref}" s="${cell.s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(val)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rIdx + 1}" ht="${ht}" customHeight="1">${cellsXml}</row>`;
    })
    .join("");

  const mergesXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
    : "";

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
  ${mergesXml}
  <pageMargins left="0.25" right="0.25" top="0.3" bottom="0.3" header="0.15" footer="0.15"/>
  <pageSetup paperSize="9" orientation="${isLandscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="1"/>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="10"/><color rgb="FF000000"/><name val="Times New Roman"/></font>
    <font><b/><sz val="10"/><color rgb="FF000000"/><name val="Times New Roman"/></font>
    <font><b/><sz val="14"/><color rgb="FF000000"/><name val="Times New Roman"/></font>
    <font><b/><sz val="9.5"/><color rgb="FF000000"/><name val="Times New Roman"/></font>
    <font><b/><sz val="10"/><color rgb="FFB00000"/><name val="Times New Roman"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFD6D6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF000000"/></left>
      <right style="thin"><color rgb="FF000000"/></right>
      <top style="thin"><color rgb="FF000000"/></top>
      <bottom style="thin"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Checklist" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const zipBytes = createZipArchive([
    { name: "[Content_Types].xml", content: contentTypesXml },
    { name: "_rels/.rels", content: rootRelsXml },
    { name: "xl/workbook.xml", content: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
    { name: "xl/styles.xml", content: stylesXml },
    { name: "xl/worksheets/sheet1.xml", content: sheetXml },
  ]);

  const xlsxName = filename.endsWith(".xlsx")
    ? filename
    : filename.replace(/\.pdf$/i, "") + ".xlsx";

  const blob = new Blob([zipBytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = xlsxName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
