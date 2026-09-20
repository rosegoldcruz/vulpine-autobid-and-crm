const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('./db');
const { extractFromPdf } = require('./extract');
const { loadProfitIndex, enrichBidFromProfitIndex } = require('./profit');
const { loadWorkbookIndex, enrichBidFromWorkbookIndex } = require('./workbook');

const app = express();
const PORT = process.env.PORT || 4400;
const profitIndex = loadProfitIndex();
const workbookIndex = loadWorkbookIndex();

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Upload a bid PDF: OCR/text extraction runs, row gets inserted ---
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const extracted = await extractFromPdf(req.file.buffer, req.file.originalname);
    const withProfit = enrichBidFromProfitIndex(extracted, req.file.originalname, profitIndex);
    const result = enrichBidFromWorkbookIndex(withProfit, req.file.originalname, workbookIndex);

    const stmt = db.prepare(`
      INSERT INTO bids (project_name, company_name, units, bid_amount, sent_date, status, filename, raw_text, projected_profit)
      VALUES (?, ?, ?, ?, ?, 'Sent', ?, ?, ?)
    `);
    const info = stmt.run(
      result.project_name,
      result.company_name,
      result.units,
      result.bid_amount,
      new Date().toISOString().slice(0, 10),
      req.file.originalname,
      result.raw_text,
      result.projected_profit
    );

    res.json({ id: info.lastInsertRowid, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// --- Get all bids ---
app.get('/api/bids', (req, res) => {
  const bids = db.prepare('SELECT * FROM bids ORDER BY sent_date DESC, id DESC').all();
  res.json(bids);
});

// --- Edit a bid (inline edits from the table) ---
app.patch('/api/bids/:id', (req, res) => {
  const { project_name, company_name, units, bid_amount, sent_date, status } = req.body;
  db.prepare(`
    UPDATE bids SET
      project_name = COALESCE(?, project_name),
      company_name = COALESCE(?, company_name),
      units = COALESCE(?, units),
      bid_amount = COALESCE(?, bid_amount),
      sent_date = COALESCE(?, sent_date),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(project_name, company_name, units, bid_amount, sent_date, status, req.params.id);
  res.json({ ok: true });
});

// --- Delete a bid ---
app.delete('/api/bids/:id', (req, res) => {
  db.prepare('DELETE FROM bids WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- KPI summary for the dashboard ---
app.get('/api/kpis', (req, res) => {
  const bids = db.prepare('SELECT * FROM bids').all();

  const totalBids = bids.length;
  const totalValue = bids.reduce((sum, b) => sum + (b.bid_amount || 0), 0);
  const totalUnits = bids.reduce((sum, b) => sum + (b.units || 0), 0);
  const profitRows = bids.filter((b) => b.projected_profit !== null && b.projected_profit !== undefined && b.bid_amount !== null && b.bid_amount !== undefined);
  const totalProfit = profitRows.reduce((sum, b) => sum + (b.projected_profit || 0), 0);
  const revenueWithProfit = profitRows.reduce((sum, b) => sum + (b.bid_amount || 0), 0);
  const estimatedCost = revenueWithProfit - totalProfit;
  const profitCoverageCount = profitRows.length;
  const profitCoveragePct = totalBids ? (profitCoverageCount / totalBids) * 100 : 0;
  const recordsNeedingReview = bids.filter((b) => !b.project_name || !b.company_name || b.company_name === 'Unknown — edit me' || b.bid_amount === null || b.bid_amount === undefined || b.units === null || b.units === undefined || b.projected_profit === null || b.projected_profit === undefined).length;
  const avgProfitPerBid = totalBids ? totalProfit / totalBids : 0;
  const avgBid = totalBids ? totalValue / bids.filter(b => b.bid_amount).length || 0 : 0;

  // By company
  const byCompany = {};
  bids.forEach(b => {
    const key = b.company_name || 'Unknown';
    byCompany[key] = (byCompany[key] || 0) + (b.bid_amount || 0);
  });

  // By status
  const byStatus = {};
  bids.forEach(b => {
    const key = b.status || 'Sent';
    byStatus[key] = (byStatus[key] || 0) + 1;
  });

  // By month sent
  const byMonth = {};
  bids.forEach(b => {
    if (!b.sent_date) return;
    const key = b.sent_date.slice(0, 7); // YYYY-MM
    byMonth[key] = (byMonth[key] || 0) + 1;
  });

  res.json({
    totalBids,
    totalValue,
    totalUnits,
    totalProfit,
    estimatedCost,
    revenueWithProfit,
    profitCoverageCount,
    profitCoveragePct,
    recordsNeedingReview,
    avgProfitPerBid,
    avgBid,
    byCompany,
    byStatus,
    byMonth
  });
});

app.listen(PORT, () => console.log(`Bid tracker running on port ${PORT}`));
