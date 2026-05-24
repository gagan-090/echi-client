import React, { useState } from 'react';
import { useAuthStore } from '../../../store/authStore';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Mock authentication
    setTimeout(() => {
      setAuth(
        { id: '1', name: 'Demo User', email },
        'mock-access-token',
        'mock-refresh-token'
      );
      setLoading(false);
    }, 1000);
  };

  return (
    <form className="w-full space-y-lg" onSubmit={handleSubmit}>
      <div className="space-y-sm">
        <div className="relative">
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs ml-unit" htmlFor="email">
            Email address
          </label>
          <input 
            type="email" 
            id="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-body-md text-on-surface placeholder:text-outline/50" 
            placeholder="name@example.com" 
            required 
          />
        </div>
        <div className="relative">
          <div className="flex justify-between items-center mb-xs ml-unit">
            <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="password">
              Password
            </label>
            <a href="#" className="font-label-sm text-label-sm text-primary hover:underline transition-all">
              Forgot password?
            </a>
          </div>
          <input 
            type="password" 
            id="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-body-md text-on-surface placeholder:text-outline/50" 
            placeholder="••••••••" 
            required 
          />
        </div>
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-sm bg-primary-container hover:bg-primary text-on-primary-container font-label-md text-label-md rounded-full shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 ease-in-out flex items-center justify-center gap-xs disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
        ) : (
          <>
            Sign in
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </>
        )}
      </button>
    </form>
  );
};

export default LoginForm;
