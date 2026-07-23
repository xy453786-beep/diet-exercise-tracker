import React, { useState } from 'react';
import { Sparkles, Mail, Lock, User, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setEmail(''); setPassword(''); setUsername(''); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAgreed) {
      setError('请先阅读并同意服务条款和隐私政策');
      return;
    }

    const emailVal = email.trim();
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setError('请输入正确的邮箱地址');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (mode === 'register' && !username.trim()) {
      setError('请输入用户名');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await signUp(emailVal, password, username.trim());
        // 注册成功后直接登录
        await signIn(emailVal, password);
      } else {
        await signIn(emailVal, password);
      }
      // onAuthStateChange 自动跳转首页
    } catch (err: any) {
      const msg = err?.message || '操作失败';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('该邮箱已注册，请直接登录');
        setMode('login');
      } else if (msg.includes('Invalid login')) {
        setError('邮箱或密码错误');
      } else {
        setError(msg);
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
            欢迎使用
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            {mode === 'login' ? '邮箱密码登录' : '新用户注册'}
          </p>
        </div>

        {/* Login / Register Toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setMode('login'); reset(); }}
            className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${
              mode === 'login'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-400'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => { setMode('register'); reset(); }}
            className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${
              mode === 'register'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-400'
            }`}
          >
            注册
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold p-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[24px] p-5 border border-purple-100/40 shadow-xl space-y-4">
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
                onChange={(e) => setEmail(e.target.value.trim())}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Username (register only) */}
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                用户名
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={14} />
                </span>
                <input
                  type="text"
                  placeholder="给自己起个名字"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                />
              </div>
            </div>
          )}

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
                type="password"
                placeholder="至少 6 位密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
            </div>
          </div>

          {/* Agreement */}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !isAgreed || email.length < 5 || password.length < 6}
            className="w-full bg-[#111111] hover:bg-black text-white font-extrabold text-[14px] py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-black/15 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{mode === 'register' ? '注册中...' : '登录中...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-[#A78BFA]" />
                <span>{mode === 'register' ? '注册并登录' : '登录'}</span>
              </>
            )}
          </button>
        </form>
      </div>

      <div className="h-4" />
    </div>
  );
}
