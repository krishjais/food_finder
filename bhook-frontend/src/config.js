// In development, an empty base uses Vite's localhost proxy. In production,
// VITE_API_BASE_URL must point at the deployed backend; an omitted value stays
// same-origin instead of accidentally requesting the visitor's localhost.
const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE_URL = configuredApiBase.replace(/\/$/, '');

export const ACTIVE_CITY = 'Lucknow';

export const DEFAULT_SEARCH_LIMIT = 10;
export const TOP_PICKS_LIMIT = 8;
