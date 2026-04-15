import React, { useState, useEffect } from 'react';
import { Shield, Mail, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config/api';

const Login = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Override autofill styling for both dark and light modes
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px ${darkMode ? '#050505' : '#FAFAF8'} inset !important;
        -webkit-text-fill-color: ${darkMode ? 'white' : '#1a1a18'} !important;
        transition: background-color 5000s ease-in-out 0s;
        caret-color: ${darkMode ? 'white' : '#1a1a18'};
      }
      input:-webkit-autofill::first-line {
        -webkit-text-fill-color: ${darkMode ? 'white' : '#1a1a18'} !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [darkMode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate password match for sign up
    if (!isLogin && password !== confirmPassword) {
      alert('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? 'api/auth/login/' : 'api/auth/signup/';
      const body = isLogin
        ? { email, password }
        : { email, password, confirm_password: confirmPassword };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        // Store auth token and user data
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        setLoading(false);
        navigate('/');
      } else {
        setError(data.error || 'Authentication failed');
        setLoading(false);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#050505]' : 'bg-[#FAFAF8]'} flex items-center justify-center p-4 sm:p-6`}>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src={darkMode ? "/grimanhwa.png" : "/grimanhwablack.png"}
            alt="Grimanhwa"
            className="h-20 mx-auto mb-4"
            onError={(e) => {
              e.target.src = `https://via.placeholder.com/80x80/${darkMode ? '0a0a0a' : 'FAFAF8'}/${darkMode ? '6b7280' : '1a1a18'}?text=G`;
            }}
          />
        </div>

        {/* Login Card */}
        <div className={`${darkMode ? 'bg-[#050505] border border-white/10' : 'bg-white border border-stone-200'} rounded-2xl p-6 sm:p-8`}>
          {/* Error Message */}
          {error && (
            <div className={`mb-6 p-4 ${darkMode ? 'bg-white/10 border border-white/20' : 'bg-red-50 border border-red-200'} rounded-xl`}>
              <p className={`${darkMode ? 'text-gray-300' : 'text-red-600'} text-sm text-center`}>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-700'} mb-2`}>
                Email
              </label>
              <div className="relative">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-stone-400'}`} size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="new-password"
                  name="user_email_random"
                  className={`w-full pl-12 pr-4 py-3.5 ${darkMode ? 'bg-[#050505] border border-white/10 text-white placeholder-gray-500 focus:border-white/30 focus:ring-white/10' : 'bg-white border border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-300 focus:ring-stone-200'} rounded-xl focus:outline-none focus:ring-1 transition-all`}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-700'} mb-2`}>
                Password
              </label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-stone-400'}`} size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  name="user_password_random"
                  className={`w-full pl-12 pr-4 py-3.5 ${darkMode ? 'bg-[#050505] border border-white/10 text-white placeholder-gray-500 focus:border-white/30 focus:ring-white/10' : 'bg-white border border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-300 focus:ring-stone-200'} rounded-xl focus:outline-none focus:ring-1 transition-all`}
                  required
                />
              </div>
            </div>

            {/* Confirm Password - Only show for Sign Up */}
            {!isLogin && (
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-700'} mb-2`}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-stone-400'}`} size={20} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    name="user_confirm_password_random"
                    className={`w-full pl-12 pr-4 py-3.5 ${darkMode ? 'bg-[#050505] border border-white/10 text-white placeholder-gray-500 focus:border-white/30 focus:ring-white/10' : 'bg-white border border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-300 focus:ring-stone-200'} rounded-xl focus:outline-none focus:ring-1 transition-all`}
                    required
                  />
                </div>
              </div>
            )}

            {/* Forgot Password - Only show for Login */}
            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  className={`text-sm ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-stone-400 hover:text-stone-600'} transition-colors`}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${darkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
              style={{ color: darkMode ? undefined : 'white' }}
            >
              {loading ? (
                <>
                  <div className={`w-5 h-5 border-2 ${darkMode ? 'border-black' : 'border-white'} border-t-transparent rounded-full animate-spin`} />
                  <span style={{ color: darkMode ? undefined : 'white' }}>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <span style={{ color: darkMode ? undefined : 'white' }}>{isLogin ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className={`flex-1 h-px ${darkMode ? 'bg-white/10' : 'bg-stone-200'}`} />
            <span className={`text-xs uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>or</span>
            <div className={`flex-1 h-px ${darkMode ? 'bg-white/10' : 'bg-stone-200'}`} />
          </div>

          {/* Social Login */}
          <button className={`w-full flex items-center justify-center gap-3 py-3.5 ${darkMode ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-stone-50 border border-stone-200 hover:bg-stone-100'} rounded-xl transition-all`}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#6b7280" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#6b7280" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#6b7280" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#6b7280" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className={`${darkMode ? 'text-gray-300' : 'text-stone-600'} font-medium`}>Continue with Google</span>
          </button>
        </div>

        {/* Sign Up Link */}
        <p className={`text-center ${darkMode ? 'text-gray-400' : 'text-stone-400'} mt-6 text-sm`}>
          {isLogin ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => setIsLogin(false)} className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-stone-600 hover:text-stone-800'} transition-colors font-semibold`}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setIsLogin(true)} className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-stone-600 hover:text-stone-800'} transition-colors font-semibold`}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Login;
