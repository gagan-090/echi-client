import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const token = searchParams.get('token');
  const ref = searchParams.get('ref');

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);

  // Auto-redirect if already logged in
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invitation token is missing. Please check your invitation link.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/email/accept-invite', {
        token,
        password,
        displayName,
        ref
      });

      const { user, accessToken } = response.data.data;
      setSuccess(true);
      
      // Log the user in and redirect to chat
      setTimeout(() => {
        setAuth(user, accessToken);
        navigate('/chat');
      }, 1500);

    } catch (err) {
      console.error('Accept invite error:', err);
      const message = err.response?.data?.message || 'Failed to complete registration. The invitation link may be invalid or expired.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="dark:bg-brand-bg-dark bg-slate-50 min-h-screen flex items-center justify-center relative overflow-hidden font-sans transition-colors duration-300">
      {/* Dynamic Background Gradients */}
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-blue-500/5 to-teal-500/5 dark:from-blue-500/10 dark:to-teal-500/5 pointer-events-none" />
      
      {/* Decorative branding watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 select-none">
        <div className="text-[120px] font-black dark:text-white text-slate-900 opacity-[0.03] dark:opacity-[0.02] tracking-[0.2em] font-headline-lg">ECHO</div>
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-4">
        <div className="dark:bg-[#060f1e] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] border dark:border-brand-border border-slate-200 p-8 md:p-10 flex flex-col transition-all duration-300">
          
          <header className="flex flex-col items-center mb-8 text-center">
            <div className="mb-3 text-brand-accent">
              <svg fill="none" height="32" viewBox="0 0 48 24" width="64" xmlns="http://www.w3.org/2000/svg">
                <path className="waveform-path" d="M2 12C2 12 6 2 10 2C14 2 18 22 22 22C26 22 30 12 34 12C38 12 42 22 46 22" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
            <h1 className="text-3xl font-serif text-brand-accent tracking-tight mb-2">Echo</h1>
            <p className="text-sm font-medium dark:text-slate-400 text-slate-500 font-headline-md">
              Secure Invitation Setup
            </p>
          </header>

          {!token ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full dark:bg-rose-500/10 bg-rose-50 border dark:border-rose-500/20 border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-500">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <h2 className="text-base font-bold dark:text-slate-200 text-slate-800 mb-2">Invalid Invite Link</h2>
              <p className="text-xs dark:text-slate-400 text-slate-500 leading-relaxed max-w-xs mx-auto mb-6">
                This invitation link appears to be invalid or incomplete. Please ensure you clicked the full link from your email.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-brand-accent/10"
              >
                Go to Login
              </button>
            </div>
          ) : success ? (
            <div className="text-center py-6 animate-fade-in">
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-6 shadow-sm mx-auto animate-bounce-subtle">
                <span className="material-symbols-outlined text-[32px]">done</span>
              </div>
              <h2 className="text-lg font-bold dark:text-slate-100 text-slate-800 mb-2">Account Created!</h2>
              <p className="text-xs dark:text-slate-400 text-slate-500 leading-relaxed max-w-xs mx-auto">
                Setting up your connection... You will be redirected to your chat screen in a moment.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 dark:bg-rose-500/10 bg-rose-50 border dark:border-rose-500/20 border-rose-100 text-rose-600 dark:text-rose-450 rounded-xl text-xs font-semibold leading-relaxed transition-all">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2.5 rounded-xl dark:bg-brand-bg-dark bg-slate-50 border dark:border-brand-border border-slate-200 focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent dark:text-slate-100 text-slate-800 placeholder-slate-400 dark:placeholder-slate-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl dark:bg-brand-bg-dark bg-slate-50 border dark:border-brand-border border-slate-200 focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent dark:text-slate-100 text-slate-800 placeholder-slate-400 dark:placeholder-slate-500 text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] select-none">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-2.5 rounded-xl dark:bg-brand-bg-dark bg-slate-50 border dark:border-brand-border border-slate-200 focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent dark:text-slate-100 text-slate-800 placeholder-slate-400 dark:placeholder-slate-500 text-sm transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-accent/10 flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">lock_open</span>
                      Secure Account
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:underline"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </main>
  );
};

export default AcceptInvite;
