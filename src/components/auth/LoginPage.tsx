import React, { useState } from 'react';
import { 
  Building2, 
  KeyRound, 
  Mail, 
  Eye, 
  EyeOff, 
  LogIn, 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { UserProfile } from '../../types';
import { INITIAL_USERS } from '../../data/mockData';
import { gabahApi } from '../../services/gabahApi';

// SECURITY (CR-02): hardcoded role passwords, defaultPasswordForRole, and the
// "1-Click Login" mechanism have been REMOVED. Authentication requires real
// credentials issued through the secure provisioning process (environment
// secrets at boot / Admin-issued credentials). There is no client-side bypass.

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  onBackToLanding: () => void;
  availableUsers?: UserProfile[];
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onBackToLanding,
  availableUsers = INITIAL_USERS,
}) => {
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await gabahApi.login(emailInput.trim(), passwordInput);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login gagal. Periksa kembali email dan kata sandi Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f7fa] text-slate-900 flex flex-col justify-between font-sans selection:bg-[#FC4A1A] selection:text-white">
      
      {/* Top Bar with Back Button */}
      <header className="bg-white border-b border-[#DFDCE3] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#4ABDAC] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda PIBC</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-[#4ABDAC]" />
          <span>Autentikasi Aman SSL / TLS 256-Bit</span>
        </div>
      </header>

      {/* Main Login Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Login Form Box (Clean White) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-[#DFDCE3] shadow-xl p-6 sm:p-8">
            
            {/* Header Form */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#4ABDAC] text-white flex items-center justify-center mx-auto shadow-md shadow-[#4ABDAC]/20 mb-3">
                <Building2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Login Portal GABAH
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                PT Food Station Tjipinang Jaya (Perseroda)
              </p>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="font-medium">{errorMessage}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Akun Pegawai
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="nama@foodstation.co.id"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABDAC] focus:border-[#4ABDAC] transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABDAC] focus:border-[#4ABDAC] transition-all font-medium font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#4ABDAC] focus:ring-[#4ABDAC] h-4 w-4"
                  />
                  <span className="text-xs text-slate-600 font-medium">Ingat perangkat ini</span>
                </label>
                <span className="text-xs text-[#FC4A1A] hover:underline cursor-pointer font-semibold">
                  Bantuan Sandi?
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#FC4A1A] hover:bg-[#e03f14] disabled:bg-[#FC4A1A]/50 text-white font-extrabold text-sm transition-all shadow-md shadow-[#FC4A1A]/20 flex items-center justify-center gap-2 active:scale-95"
              >
                {isLoading ? (
                  <span>Memverifikasi akun...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Sistem GABAH</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
              Butuh akun baru atau reset kredensial? Hubungi IT Service Desk ext. <strong>108</strong> atau WhatsApp Helpdesk.
            </div>

          </div>

          {/* Right Column: Security Notice (credentials are no longer displayed) */}
          <div className="lg:col-span-6 space-y-4">
            
            <div className="bg-white rounded-2xl border border-[#DFDCE3] shadow-md p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[#2d7f74] font-bold text-sm mb-1">
                <ShieldCheck className="w-4 h-4 text-[#4ABDAC]" />
                <span>Kredensial Resmi Perusahaan</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Demi keamanan data BUMD, kata sandi tidak ditampilkan di halaman login dan tidak
                tersedia tombol masuk instan. Setiap akun menerima kredensial awal melalui
                proses provisioning resmi, dan wajib menggantinya setelah login pertama.
              </p>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#f8f7fa] border border-[#DFDCE3] flex items-start gap-3">
                  <KeyRound className="w-4 h-4 text-[#4ABDAC] shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <strong>Belum punya kata sandi?</strong> Ajukan melalui IT Service Desk
                    (ext. 108). Administrator akan menerbitkan kredensial melalui jalur
                    resmi — bukan melalui email atau pesan publik.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#f8f7fa] border border-[#DFDCE3] flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#4ABDAC] shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <strong>Kebijakan sesi:</strong> sesi aktif memiliki masa berlaku terbatas dan
                    otomatis dicabut saat kata sandi atau hak akses Anda berubah. Keluar
                    (logout) akan langsung mendaftarkan token sesi sebagai tidak valid.
                  </div>
                </div>
              </div>
            </div>

            {/* SLA & Security Compliance Notice */}
            <div className="p-4 rounded-xl bg-[#4ABDAC]/10 border border-[#4ABDAC]/30 text-xs text-slate-800 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#4ABDAC] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Ketentuan Keamanan BUMD:</strong> jangan pernah membagikan kata sandi Anda.
                Sistem mencatat seluruh aktivitas autentikasi dan alih peran untuk kepatuhan audit.
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-[#DFDCE3] bg-white">
        &copy; {new Date().getFullYear()} PT Food Station Tjipinang Jaya (Perseroda) — Sistem GABAH Enterprise
      </footer>

    </div>
  );
};
