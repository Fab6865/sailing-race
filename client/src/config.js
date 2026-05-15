// API URL configuration
// In production, use the Render backend URL
// In development, use localhost (via Vite proxy)

const isProduction = import.meta.env.PROD;

export const API_URL = isProduction 
  ? 'https://sailing-race.onrender.com' 
  : '';

export const apiUrl = (path) => `${API_URL}${path}`;
