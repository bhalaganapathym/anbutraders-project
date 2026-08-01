import { useState } from 'react';
import { useAuth, User } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { Lock, User as UserIcon, HelpCircle } from 'lucide-react';
import Modal from '@/components/Modal';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const quickRoleLogin = async (targetUsername: string) => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const formData = new URLSearchParams();
      formData.append('username', targetUsername);
      formData.append('password', '');
      
      const res = await fetch(`${API_URL}/login/access-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || 'Login failed');
      }
      
      const payload = await res.json();
      const userRes = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${payload.access_token}`
        }
      });
      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();
      
      login(payload.access_token, userData);
    } catch (e: any) {
      toast(e.message || 'Login failed', 'error');
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      toast('Please enter username', 'error');
      return;
    }
    if (username.toLowerCase() !== 'billing' && username.toLowerCase() !== 'dispatch' && !password) {
      toast('Please enter password', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password || '');
      
      const res = await fetch(`${API_URL}/login/access-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || 'Invalid credentials');
      }
      
      const payload = await res.json();
      
      const userRes = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${payload.access_token}`
        }
      });
      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();
      
      login(payload.access_token, userData);
    } catch (e: any) {
      toast(e.message || 'Login failed', 'error');
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUsername || !secretAnswer || !newPassword) {
      toast('Please fill all fields', 'error');
      return;
    }
    setResetLoading(true);
    try {
      await api.post('/reset-password', {
        username: resetUsername,
        secret_answer: secretAnswer,
        new_password: newPassword
      });
      toast('Password reset successful. You can now login.', 'success');
      setForgotOpen(false);
      setResetUsername('');
      setSecretAnswer('');
      setNewPassword('');
    } catch (e: any) {
      toast('Reset failed. Check your secret answer.', 'error');
    }
    setResetLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-amber-600 p-8 text-center">
          <h1 className="text-3xl font-extrabold text-white">Anbu Traders</h1>
          <p className="mt-2 font-medium text-amber-100">Sign in to your account</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                className="input pl-10"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <button 
                type="button" 
                onClick={() => setForgotOpen(true)}
                className="text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                className="input pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-600 py-3 font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 text-center uppercase tracking-wider mb-3">Quick Login (No Password Required)</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => quickRoleLogin('billing')}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:border-amber-200 transition"
              >
                Billing Team
              </button>
              <button
                type="button"
                onClick={() => quickRoleLogin('dispatch')}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:border-amber-200 transition"
              >
                Dispatch Team
              </button>
            </div>
          </div>
        </form>
      </div>

      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Reset Password" size="sm">
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input 
              type="text" 
              className="input" 
              value={resetUsername} 
              onChange={e => setResetUsername(e.target.value)} 
            />
          </div>
          <div>
            <label className="label flex items-center gap-1">
              <HelpCircle size={14} className="text-amber-600"/> Secret Question
            </label>
            <p className="text-sm text-slate-600 mb-2 italic">"What is your favorite color?"</p>
            <input 
              type="text" 
              className="input" 
              placeholder="Your answer"
              value={secretAnswer} 
              onChange={e => setSecretAnswer(e.target.value)} 
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input 
              type="password" 
              className="input" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setForgotOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={resetLoading} className="btn-primary">
              {resetLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
