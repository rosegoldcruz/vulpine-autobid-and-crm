const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'bids.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT,
    company_name TEXT,
    units INTEGER,
    bid_amount REAL,
    sent_date TEXT,
    status TEXT DEFAULT 'Sent',
    filename TEXT,
    raw_text TEXT,
    projected_profit REAL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const columns = db.prepare("PRAGMA table_info(bids)").all().map((c) => c.name);
if (!columns.includes('projected_profit')) {
  db.exec('ALTER TABLE bids ADD COLUMN projected_profit REAL');
}

module.exports = db;
