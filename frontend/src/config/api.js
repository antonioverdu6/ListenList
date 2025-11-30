// src/config/api.js
// Detect base URL prioritizing environment variable injected at build time.
// Fallback only if not present.
const envUrl = process.env.REACT_APP_API_URL;
// Normalize (remove trailing slash) if provided
const normalized = envUrl ? envUrl.replace(/\/$/, '') : null;
const API_URL = normalized || 'http://localhost:8000';

// Simple diagnostic in console (harmless in production) to verify which URL is used.
if (typeof window !== 'undefined') {
	// eslint-disable-next-line no-console
	console.log('[API_URL] Using base:', API_URL);
}

export default API_URL;
