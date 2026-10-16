// Review warnings describe draft status; pricing errors still block export.
export const planReviewWarnings = new Set([
 'Plan-derived unit mix requires human review.',
 'Plan-derived quantities require human review.'
]);

export function draftExportState(job, scopeNotes = '') {
 const warnings = [...new Set(job.exceptions.filter(value => planReviewWarnings.has(value)))];
 return {...job.state, notes:[
  'DRAFT - PRICED SCOPE ONLY. This is not a complete project bid. Unpriced or unresolved scope is excluded from the total. No supplier or finish substitution is authorized by this document.',
  ...warnings,
  scopeNotes.trim() ? 'SCOPE RECONCILIATION / EXCLUSIONS:\n'+scopeNotes.trim() : '',
  job.state.notes
 ].filter(Boolean).join('\n\n')};
}

export async function markDraftPdf(PDFLib, bytes) {
 const doc=await PDFLib.PDFDocument.load(bytes);
 const font=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
 for(const page of doc.getPages()) {
  const width=page.getWidth();
  page.drawRectangle({x:0,y:page.getHeight()-22,width,height:22,color:PDFLib.rgb(1,.94,.8)});
  page.drawText('DRAFT - PRICED SCOPE ONLY - SEE NOTES / EXCLUSIONS',{x:18,y:page.getHeight()-15,size:9,font,color:PDFLib.rgb(.35,.15,0)});
 }
 return Buffer.from(await doc.save());
}
