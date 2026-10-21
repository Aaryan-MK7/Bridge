const REQUEST_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'withdrawn',
  'letter_generated',
  'signing_in_progress',
  'sent_for_signing',
  'signed',
  'completed',
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  pending: new Set(['approved', 'rejected', 'withdrawn']),
  approved: new Set(['letter_generated', 'signing_in_progress', 'sent_for_signing', 'completed']),
  rejected: new Set(['pending']),
  withdrawn: new Set(['pending']),
  letter_generated: new Set(['signing_in_progress', 'sent_for_signing', 'completed']),
  signing_in_progress: new Set(['approved', 'letter_generated', 'sent_for_signing']),
  sent_for_signing: new Set(['signed', 'completed']),
  signed: new Set(['completed']),
  completed: new Set(),
});

function canTransitionRequestStatus(from, to) {
  return from === to || Boolean(ALLOWED_TRANSITIONS[from]?.has(to));
}

module.exports = {
  ALLOWED_TRANSITIONS,
  REQUEST_STATUSES,
  canTransitionRequestStatus,
};
