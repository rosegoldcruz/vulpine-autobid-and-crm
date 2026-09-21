const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { normalizeForMatch, findProfitMatch } = require('./profit');

function cleanupWorkbookName(name) {
  return String(name || '')
    .replace(/\.xlsx$/i, '')
    .replace(/\(\d+\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadWorkbookIndex(workbookDir = path.join(__dirname, 'uploads', 'vulpine_workbooks')) {
  if (!fs.existsSync(workbookDir)) return [];

  return fs
    .readdirSync(workbookDir)
    .filter((f) => f.toLowerCase().endsWith('.xlsx'))
    .map((file) => {
      const projectName = cleanupWorkbookName(file);
      return {
        project_name: projectName,
        normalized: normalizeForMatch(projectName),
        workbook_path: path.join(workbookDir, file),
        profit: null,
      };
    });
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(/[$,\s]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractWorkbookMetrics(workbookPath) {
  try {
    const wb = XLSX.readFile(workbookPath, { cellDates: false });

    const bidCandidates = [];
    const unitCandidates = [];

    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true });
      for (const row of rows) {
        if (!Array.isArray(row)) continue;

        for (let i = 0; i < row.length; i += 1) {
          const cell = row[i];
          if (typeof cell !== 'string') continue;
          const lower = cell.toLowerCase();

          if (/(grand\s*total|contract\s*price|bid\s*total|proposal\s*total|total)/.test(lower)) {
            for (let j = i + 1; j < Math.min(row.length, i + 8); j += 1) {
              const n = toNumber(row[j]);
              if (n !== null && n >= 1000) bidCandidates.push(n);
            }
          }

          if (/units?/.test(lower)) {
            for (let j = i + 1; j < Math.min(row.length, i + 6); j += 1) {
              const n = toNumber(row[j]);
              if (n !== null && Number.isInteger(n) && n >= 1 && n <= 5000) {
                unitCandidates.push(n);
              }
            }

            const inline = cell.match(/(\d{1,4})\s*units?/i);
            if (inline) {
              const n = Number.parseInt(inline[1], 10);
              if (n >= 1 && n <= 5000) unitCandidates.push(n);
            }
          }
        }
      }
    }

    const bid_amount = bidCandidates.length ? Math.max(...bidCandidates) : null;
    const units = unitCandidates.length ? Math.max(...unitCandidates) : null;

    return { bid_amount, units };
  } catch {
    return { bid_amount: null, units: null };
  }
}

function enrichBidFromWorkbookIndex(bid, filename, workbookIndex) {
  const match = findProfitMatch(workbookIndex, bid.project_name, filename);
  if (!match || !match.workbook_path) return bid;

  const metrics = extractWorkbookMetrics(match.workbook_path);
  return {
    ...bid,
    bid_amount: bid.bid_amount ?? metrics.bid_amount,
    units: bid.units ?? metrics.units,
  };
}

module.exports = {
  loadWorkbookIndex,
  enrichBidFromWorkbookIndex,
  extractWorkbookMetrics,
};
