export function getApiBaseUrl() {
  const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '').trim();
  if (configuredApiUrl) return configuredApiUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/+$/, '')}/api`;
  }

  return 'http://localhost:4000/api';
}

export function getFrontendPort() {
  const rawPort = process.env.PORT || '3000';
  const port = Number(rawPort);
  return Number.isFinite(port) && port > 0 ? port : 3000;
}

export const API_BASE_URL = getApiBaseUrl();
