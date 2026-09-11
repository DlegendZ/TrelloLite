import axios from 'axios';
import { IS_DEMO } from './demo';

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/v1';
const LOGIN_URL = `${import.meta.env.BASE_URL}login`;

// Demo build (GitHub Pages): serve every request from an in-browser mock API
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  ...(IS_DEMO && {
    adapter: async (config) => (await import('./demoAdapter')).demoAdapter(config),
  }),
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, attempt token refresh once
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original.url?.includes('/auth/login') || original.url?.includes('/auth/register');
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken && !IS_DEMO) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          localStorage.setItem('access_token', data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = LOGIN_URL;
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = LOGIN_URL;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
