import React, { useState } from 'react';
import { Sparkles, Check, Mail, Lock, ArrowLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();

  // View mode: 'login' | 'register'
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Agreement
  const [isAgreed, setIsAgreed] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setShowPassword(false);
    setError('');
    setSuccessMessage('');
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!isAgreed) {
      setError('请先阅读并同意服务条款和隐私政策');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }

    if (password.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }

    if (mode === 'register' && !username.trim()) {
      setError('请输入昵称');
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'register') {
        await signUp(email.trim(), password, username.trim() || '健康达人');
        setSuccessMessage('注册成功！如需邮箱验证，请查看收件箱。现在可以登录了。');
        setMode('login');
        setPassword('');
      } else {
        await signIn(email.trim(), password);
        // AuthContext handles the redirect automatically via onAuthStateChange
      }
    } catch (err: any) {
      const message = err?.message || '登录失败，请重试';
      if (message.includes('Invalid login credentials')) {
        setError('邮箱或密码不正确');
      } else if (message.includes('Email not confirmed')) {
        setError('邮箱尚未验证，请检查收件箱');
      } else if (message.includes('User already registered')) {
        setError('该邮箱已注册，请直接登录');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-[#FAF5FF] via-slate-50 to-white text-gray-800 flex flex-col justify-between p-6 relative overflow-hidden font-sans select-none text-left">
      {/* Ambient highlights */}
      <div className="absolute top-[-80px] left-[-80px] w-[260px] h-[260px] rounded-full bg-[#8B5CF6]/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[260px] h-[260px] rounded-full bg-[#8B5CF6]/4 blur-3xl pointer-events-none" />

      <div className="h-6" />

      <div className="flex-1 flex flex-col justify-center max-w-[320px] mx-auto w-full space-y-6 py-4">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] px-3 py-1 rounded-full text-[10px] font-black tracking-wider">
            <Sparkles size={12} className="animate-pulse" />
            AI 智能健康助手
          </div>
          <h1 className="text-[22px] font-black text-gray-900 tracking-tight mt-2">
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            {mode === 'login' ? '登录以继续你的健康旅程' : '开始你的智能健康管理'}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-[11px] font-bold p-3 rounded-xl text-center">
            ✓ {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold p-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Login/Register Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[24px] p-5 border border-purple-100/40 shadow-xl space-y-4">
          {/* Username (register only) */}
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                昵称
              </label>
              <input
                type="text"
                placeholder="你的健康昵称"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              邮箱地址
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail size={14} />
              </span>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              密码
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={14} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="至少6位密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Agreement Toggle */}
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={() => setIsAgreed(!isAgreed)}
              className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-300 flex-shrink-0 cursor-pointer ${
                isAgreed
                  ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-xs'
                  : 'border-gray-300 bg-white text-transparent hover:border-gray-400'
              }`}
            >
              <Check size={10} className="font-black" />
            </button>
            <p className="text-[10px] text-gray-500 leading-relaxed font-bold">
              同意{' '}
              <span className="underline text-gray-600 cursor-pointer">《服务条款》</span>{' '}
              和{' '}
              <span className="underline text-gray-600 cursor-pointer">《隐私政策》</span>
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#111111] hover:bg-black text-white font-extrabold text-[14px] py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-black/15 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>处理中...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-[#A78BFA]" />
                <span>{mode === 'login' ? '登录' : '注册'}</span>
              </>
            )}
          </button>
        </form>

        {/* Switch Mode */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="text-xs font-bold text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
          >
            {mode === 'login' ? '没有账号？立即注册' : '已有账号？去登录'}
          </button>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
