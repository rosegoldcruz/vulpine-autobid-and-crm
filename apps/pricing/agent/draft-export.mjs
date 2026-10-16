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
