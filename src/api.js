const localApi =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://127.0.0.1:8000/api'
    : '/api';

export const API = import.meta.env.VITE_API_URL || localApi;
