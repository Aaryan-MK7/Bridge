export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function formatDateTime(value) {
  return formatDate(value, { hour: 'numeric', minute: '2-digit' });
}

export function countByStatus(requests, statuses) {
  const accepted = new Set(statuses);
  return requests.filter((request) => accepted.has(String(request.status).toLowerCase())).length;
}
