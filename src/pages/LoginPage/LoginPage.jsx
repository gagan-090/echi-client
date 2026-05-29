import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const LoginPage = () => {
  const [authMethod, setAuthMethod] = useState('qr'); // 'qr' | 'phone' | 'email'
  
  // Email states
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emailPending, setEmailPending] = useState(false);
  
  // Phone states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);

  // QR States
  const [qrToken, setQrToken] = useState(null);
  const [qrSessionId, setQrSessionId] = useState(null);
  const [qrStatus, setQrStatus] = useState('pending'); // pending, confirmed, expired

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const setAuth = useAuthStore(state => state.setAuth);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const pollInterval = useRef(null);

  // Handle email verification token from URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      verifyEmailToken(token);
    }
  }, [searchParams]);

  // Handle phone countdown
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Handle QR generation on mount or tab switch
  useEffect(() => {
    if (authMethod === 'qr' && !qrToken) {
      generateQrSession();
    }
    
    // Stop polling if we switch away from QR tab
    if (authMethod !== 'qr') {
      stopPolling();
    }
    
    return () => stopPolling();
  }, [authMethod]);

  const generateQrSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.post('/auth/qr-session');
      setQrToken(data.data.qrToken);
      setQrSessionId(data.data.sessionId);
      setQrStatus('pending');
      startPolling(data.data.sessionId);
    } catch (err) {
      setError('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (sessionId) => {
    stopPolling();
    pollInterval.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/auth/qr-session/${sessionId}`);
        if (data.data.status === 'confirmed') {
          stopPolling();
          exchangeQrSession(sessionId);
        } else if (data.data.status === 'expired') {
          stopPolling();
          setQrStatus('expired');
        }
      } catch (err) {
        // Just ignore polling errors so it continues trying
        console.error('Polling error', err);
      }
    }, 2000); // Poll every 2 seconds
  };

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };

  const exchangeQrSession = async (sessionId) => {
    try {
      const { data } = await api.post('/auth/qr-exchange', { sessionId });
      setAuth(data.data.user, data.data.accessToken);
    } catch (err) {
      setError('Failed to complete QR login');
      setQrStatus('expired');
    }
  };

  const verifyEmailToken = async (token) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/email/verify', { token });
      if (data.data.user) {
        setAuth(data.data.user, data.data.accessToken);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification link');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        const { data } = await api.post('/auth/email/login', { email, password });
        setAuth(data.data.user, data.data.accessToken);
      } else {
        await api.post('/auth/email/register', { email, password, display_name: displayName });
        setEmailPending(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (!otpSent) {
        await api.post('/auth/phone/send-otp', { phoneNumber, purpose: 'phone_login' });
        setOtpSent(true);
        setCountdown(60);
      } else {
        const code = otp.join('');
        const { data } = await api.post('/auth/phone/verify-otp', { phoneNumber, code, purpose: 'phone_login' });
        if (data.data.user) {
          setAuth(data.data.user, data.data.accessToken);
        } else {
          setError('User not found. Please register first.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^[0-9]*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value !== '' && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
    if (value === '' && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  return (
    <main className="bg-[#f2f4f6] min-h-screen flex items-center justify-center relative overflow-hidden font-sans">
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-blue-50/50 to-teal-50/30" />
      
      {/* Top Left Close Button */}
      <div className="absolute top-8 left-8 z-20">
        <button className="bg-[#4a5056] text-white px-4 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-700 transition-colors">
          Close
        </button>
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 flex flex-col items-center">
          
          {emailPending ? (
            <div className="w-full text-center flex flex-col items-center animate-fade-in">
              {/* Wave Logo */}
              <div className="mb-2 flex items-center justify-center">
                <img src="/logo.png" alt="Echo Logo" className="h-14 w-14 object-contain" />
              </div>
              <h1 className="text-3xl font-serif text-[#067268] tracking-tight mb-2">Echo</h1>
              <p className="text-lg italic text-gray-500 mb-10 font-serif">
                Clear conversations.
              </p>

              <div className="w-16 h-16 bg-[#067268] text-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="text-[19px] text-gray-800 mb-6 font-medium">Check your email</h2>
              <p className="text-[15px] text-gray-600 mb-2 leading-relaxed">
                We sent a verification link to <br/>
                <strong className="text-gray-800 font-semibold tracking-wide">{email}</strong>
              </p>
              <button 
                onClick={() => setEmailPending(false)}
                className="mt-6 text-[#067268] font-medium hover:underline text-[15px]"
              >
                Back to login
              </button>
            </div>
          ) : (
            <>
              <header className="flex flex-col items-center mb-10 text-center">
                <div className="mb-2 flex items-center justify-center">
                  <img src="/logo.png" alt="Echo Logo" className="h-14 w-14 object-contain" />
                </div>
                <h1 className="text-3xl font-serif text-[#067268] tracking-tight mb-2">Echo</h1>
                <p className="text-lg italic text-gray-500 font-serif">
                  Clear conversations.
                </p>
              </header>
              {/* Tab Switcher */}
              <div className="w-full flex bg-surface-container rounded-full p-1 mb-lg">
                <button
                  className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${authMethod === 'qr' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => { setAuthMethod('qr'); setError(null); }}
                >
                  QR Scan
                </button>
                <button
                  className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${authMethod === 'phone' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => { setAuthMethod('phone'); setError(null); }}
                >
                  Phone
                </button>
                <button
                  className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${authMethod === 'email' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => { setAuthMethod('email'); setError(null); }}
                >
                  Email
                </button>
              </div>

              {error && (
                <div className="w-full mb-md p-sm bg-error/10 border border-error/30 text-error rounded-lg text-center font-label-md">
                  {error}
                </div>
              )}

              {/* QR Auth Form */}
              {authMethod === 'qr' && (
                <div className="w-full flex flex-col items-center">
                  <p className="text-body-sm text-on-surface-variant mb-lg text-center">
                    Open Echo on your phone, go to Settings, and select <strong className="text-on-surface">Linked Devices</strong> to scan.
                  </p>
                  
                  <div className="bg-white p-4 rounded-xl shadow-sm mb-lg">
                    {qrStatus === 'pending' && qrToken ? (
                      <QRCodeSVG value={qrToken} size={200} />
                    ) : (
                      <div className="w-[200px] h-[200px] flex items-center justify-center bg-surface-container-high text-on-surface-variant rounded-xl cursor-pointer" onClick={generateQrSession}>
                        {loading ? (
                          <span className="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="material-symbols-outlined text-[32px] mb-xs">refresh</span>
                            <span className="font-label-sm">Reload QR</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {qrStatus === 'expired' && (
                    <p className="text-error font-label-sm mb-md">QR code expired. Click reload.</p>
                  )}
                </div>
              )}

              {/* Phone Auth Form */}
              {authMethod === 'phone' && (
                <form className="w-full space-y-lg" onSubmit={handlePhoneSubmit}>
                  {!otpSent ? (
                    <div className="relative">
                      <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs ml-unit">Phone number</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-outline/50"
                        placeholder="+1234567890"
                        required
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <p className="text-body-sm text-on-surface-variant mb-md">Enter code sent to {phoneNumber}</p>
                      <div className="flex justify-between w-full gap-2 mb-md">
                        {otp.map((digit, i) => (
                          <input
                            key={i}
                            id={`otp-${i}`}
                            type="text"
                            maxLength="1"
                            value={digit}
                            onChange={(e) => handleOtpChange(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            className="w-12 h-14 text-center text-title-lg font-title-lg rounded-lg bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                          />
                        ))}
                      </div>
                      {countdown > 0 ? (
                        <p className="text-body-sm text-on-surface-variant">Resend code in {countdown}s</p>
                      ) : (
                        <button 
                          type="button" 
                          onClick={() => { setOtpSent(false); setOtp(['','','','','','']); }}
                          className="text-primary text-label-sm hover:underline"
                        >
                          Resend Code
                        </button>
                      )}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={loading || (otpSent && otp.join('').length !== 6)}
                    className="w-full py-sm bg-primary-container hover:bg-primary text-on-primary-container hover:text-white font-label-md text-label-md rounded-full shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 flex items-center justify-center gap-xs disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : (otpSent ? 'Verify Code' : 'Send Code')}
                  </button>
                </form>
              )}

              {/* Email Auth Form */}
              {authMethod === 'email' && (
                <form className="w-full space-y-lg" onSubmit={handleEmailSubmit}>
                  <div className="space-y-sm">
                    {!isLogin && (
                      <div className="relative">
                        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs ml-unit">Display name</label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-outline/50"
                          placeholder="Jane Doe"
                          required={!isLogin}
                        />
                      </div>
                    )}
                    
                    <div className="relative">
                      <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs ml-unit">Email address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-outline/50"
                        placeholder="name@example.com"
                        required
                      />
                    </div>
                    
                    <div className="relative">
                      <div className="flex justify-between items-center mb-xs ml-unit">
                        <label className="font-label-sm text-label-sm text-on-surface-variant">Password</label>
                        {isLogin && <a href="#" className="font-label-sm text-label-sm text-primary hover:underline">Forgot?</a>}
                      </div>
                      <input
                        type="password"
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
                    className="w-full py-sm bg-primary-container hover:bg-primary text-on-primary-container hover:text-white font-label-md text-label-md rounded-full shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 flex items-center justify-center gap-xs disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : (isLogin ? 'Sign in' : 'Create account')}
                  </button>

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
                </form>
              )}
            </>
          )}
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
