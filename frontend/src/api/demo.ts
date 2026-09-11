// Demo build (GitHub Pages): `vite --mode demo` loads frontend/.env.demo
export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';

export const DEMO_ACCOUNT = { email: 'demo@trellolite.dev', password: 'Demo1234' };

export const DEMO_STORAGE_KEY = 'trellolite_demo_db';
