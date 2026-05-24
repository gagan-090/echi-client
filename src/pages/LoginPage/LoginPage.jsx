import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        const { data } = await api.post('/auth/login', { email, password });
        setAuth(data.data.user, data.data.accessToken);
      } else {
        const { data } = await api.post('/auth/register', { email, password, display_name: displayName });
        setAuth(data.data.user, data.data.accessToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-background min-h-screen flex items-center justify-center p-margin-mobile md:p-margin-desktop font-body-md text-body-md text-on-surface relative overflow-hidden">
      {/* Grain Texture */}
      <div className="fixed inset-0 grain-overlay z-0" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-lg md:p-xl flex flex-col items-center">
          {/* Brand Identity */}
          <header className="flex flex-col items-center mb-xl text-center">
            <div className="mb-sm text-primary">
              <svg fill="none" height="24" viewBox="0 0 48 24" width="48" xmlns="http://www.w3.org/2000/svg">
                <path className="waveform-path" d="M2 12C2 12 6 2 10 2C14 2 18 22 22 22C26 22 30 12 34 12C38 12 42 22 46 22" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
            <h1 className="font-display-lg text-headline-lg text-primary tracking-tight mb-xs">Echo</h1>
            <p className="font-display-lg text-body-lg italic text-outline opacity-80">
              {isLogin ? 'Welcome back' : 'Join the conversation'}
            </p>
          </header>

          {/* Form */}
          <form className="w-full space-y-lg" onSubmit={handleSubmit}>
            {error && (
              <div className="p-sm bg-error/10 border border-error/30 text-error rounded-lg text-center font-label-md">
                {error}
              </div>
            )}
            
            <div className="space-y-sm">
              {!isLogin && (
                <div className="relative">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs ml-unit" htmlFor="name">
                    Display name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-outline/50"
                    placeholder="Jane Doe"
                    required={!isLogin}
                  />
                </div>
              )}
              
              <div className="relative">
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs ml-unit" htmlFor="email">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-outline/50"
                  placeholder="name@example.com"
                  required
                />
              </div>
              
              <div className="relative">
                <div className="flex justify-between items-center mb-xs ml-unit">
                  <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="password">
                    Password
                  </label>
                  {isLogin && (
                    <a href="#" className="font-label-sm text-label-sm text-primary hover:underline transition-all">
                      Forgot?
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-outline/50"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-sm bg-primary-container hover:bg-primary text-on-primary-container hover:text-white font-label-md text-label-md rounded-full shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 ease-in-out flex items-center justify-center gap-xs disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <>
                  {isLogin ? 'Sign in' : 'Create account'}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <footer className="mt-xl text-center">
            <p className="font-label-sm text-label-sm text-outline">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-bold hover:underline transition-all"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </footer>
        </div>

        {/* Decorative blurs */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-secondary-container/10 rounded-full blur-3xl -z-10" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary-container/10 rounded-full blur-3xl -z-10" />
      </div>

      {/* Ambient light */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20 z-0">
        <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] bg-primary-fixed-dim rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-secondary-fixed-dim rounded-full blur-[100px]" />
      </div>
    </main>
  );
};

export default LoginPage;
