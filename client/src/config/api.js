const configuredApiUrl = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export const API_URL = configuredApiUrl.replace(/\/+$/, '');
