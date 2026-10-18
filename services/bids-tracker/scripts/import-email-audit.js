const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');

// Keep customer correspondence in ignored runtime data, outside source control.
const { matches, unresolved, companyUpdates = [] } = JSON.parse(
  fs.readFileSync(path.join(process.env.TRACKER_DATA_DIR || path.join(__dirname, '../data'), 'email-audit.json'), 'utf8')
);

const update = db.prepare(`
  UPDATE bids SET sent_date = ?, sent_time = ?, sent_timezone = 'MST',
    recipient_name = ?, recipient_email = ?, email_subject = ?,
    gmail_message_id = ?, email_match_status = 'verified'
  WHERE id = ?
`);
const clear = db.prepare(`
  UPDATE bids SET sent_date = NULL, sent_time = NULL, sent_timezone = NULL,
    recipient_name = NULL, recipient_email = NULL, email_subject = ?,
    gmail_message_id = NULL, email_match_status = 'unverified'
  WHERE id = ?
`);

db.transaction(() => {
  for (const [id,date,time,name,email,subject,messageId] of matches) {
    update.run(date,time,name,email,subject,messageId,id);
  }
  for (const [id,note] of unresolved) clear.run(note,id);
  const company = db.prepare('UPDATE bids SET company_name = ? WHERE id = ?');
  for (const {id, companyName} of companyUpdates) company.run(companyName,id);
})();

const counts = db.prepare(`SELECT email_match_status, COUNT(*) AS count FROM bids GROUP BY email_match_status`).all();
console.log(JSON.stringify(counts));
db.close();
