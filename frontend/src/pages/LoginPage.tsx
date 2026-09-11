import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Trello } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import type { ApiError } from '../types';
import { IS_DEMO, DEMO_ACCOUNT, DEMO_STORAGE_KEY } from '../api/demo';

function resetDemoData() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  toast.success('Demo data reset');
}

export function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      const msg = axiosErr.response?.data?.error?.message ?? 'Invalid email or password';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <Trello size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Welcome back</h1>
          <p className="text-slate-400 mt-1 text-sm">Sign in to TrelloLite</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={errors.email}
              icon={<Mail size={16} />}
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              error={errors.password}
              icon={<Lock size={16} />}
              autoComplete="current-password"
            />
            <Button type="submit" loading={isLoading} className="mt-2 w-full" size="lg">
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Register
            </Link>
          </p>
        </div>

        {IS_DEMO && (
          <div className="mt-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-5 text-sm">
            <p className="font-medium text-indigo-300">Live demo</p>
            <p className="text-slate-400 mt-1">
              No backend here — the API is simulated and your changes are saved in this browser only.
            </p>
            <p className="font-mono text-xs text-slate-300 mt-3">
              {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}
            </p>
            <div className="flex gap-2 mt-3">
              <Button type="button" size="sm" onClick={() => setForm({ ...DEMO_ACCOUNT })}>
                Use demo account
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetDemoData}>
                Reset demo data
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
