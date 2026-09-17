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
  AlertCircle,
  HelpCircle,
  UserCheck
} from 'lucide-react';
import { UserProfile } from '../../types';
import { INITIAL_USERS } from '../../data/mockData';
import { gabahApi } from '../../services/gabahApi';

const defaultPasswordForRole: Record<string, string> = {
  'Admin GABAH': 'AdminGabah#2026',
  'Superadmin': 'AdminGabah#2026',
  'IT': 'ItStaff#2026',
  'GA': 'GaStaff#2026',
  'Supply Chain': 'ScStaff#2026',
  'PIBC': 'PibcStaff#2026',
  'Karyawan': 'Karyawan#2026',
  'Auditor': 'Auditor#2026',
};

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
  const users = (availableUsers && availableUsers.length > 0) ? availableUsers : INITIAL_USERS;
  const [selectedUser, setSelectedUser] = useState<UserProfile>(users[0]);
  const [emailInput, setEmailInput] = useState<string>(users[0]?.email || '');
  const [passwordInput, setPasswordInput] = useState<string>(defaultPasswordForRole[users[0]?.role] || 'AdminGabah#2026');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSelectUserQuick = (u: UserProfile) => {
    setSelectedUser(u);
    setEmailInput(u.email);
    setPasswordInput(defaultPasswordForRole[u.role] || u.temp_password || 'AdminGabah#2026');
    setErrorMessage(null);
  };

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

          {/* Right Column: Interactive Quick Demo Accounts Switcher (Clean White) */}
          <div className="lg:col-span-6 space-y-4">
            
            <div className="bg-white rounded-2xl border border-[#DFDCE3] shadow-md p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[#2d7f74] font-bold text-sm mb-1">
                <KeyRound className="w-4 h-4 text-[#4ABDAC]" />
                <span>Password Sementara Setiap User (Siap Pakai)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Sistem telah membuat <strong>Password Sementara</strong> resmi untuk setiap role jabatan di BUMD Food Station. Klik tombol <strong>"1-Click Login"</strong> untuk langsung masuk:
              </p>

              <div className="space-y-2.5">
                {(availableUsers || INITIAL_USERS).map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUserQuick(u)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-[#4ABDAC]/10 border-[#4ABDAC] shadow-xs' 
                          : 'bg-[#f8f7fa] hover:bg-slate-100 border-[#DFDCE3]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={u.avatar} 
                          alt={u.name} 
                          className="w-10 h-10 rounded-full object-cover border-2 border-[#4ABDAC]/40 shrink-0" 
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">{u.name}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                              u.role === 'Admin GABAH' ? 'bg-[#4ABDAC]/20 text-[#206f65] border-[#4ABDAC]/40' :
                              u.role === 'IT' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              u.role === 'GA' ? 'bg-[#F7B733]/25 text-amber-900 border-[#F7B733]/40' :
                              u.role === 'Supply Chain' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                              u.role === 'PIBC' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                              'bg-[#DFDCE3] text-slate-800 border-slate-300'
                            }`}>
                              {u.role_label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">{u.email}</div>
                          <div className="text-[11px] text-amber-900 font-mono font-bold mt-0.5">
                            Pass: {defaultPasswordForRole[u.role] || 'AdminGabah#2026'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          handleSelectUserQuick(u);
                          setIsLoading(true);
                          setErrorMessage(null);
                          try {
                            const pwd = defaultPasswordForRole[u.role] || 'AdminGabah#2026';
                            const res = await gabahApi.login(u.email, pwd);
                            onLoginSuccess(res.user);
                          } catch (err: any) {
                            setErrorMessage(err.message || 'Login gagal.');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#4ABDAC] hover:bg-[#3ea395] text-white font-bold text-[11px] shrink-0 transition-colors shadow-xs"
                      >
                        1-Click Login
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* SLA & Security Compliance Notice */}
            <div className="p-4 rounded-xl bg-[#4ABDAC]/10 border border-[#4ABDAC]/30 text-xs text-slate-800 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#4ABDAC] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Ketentuan Keamanan BUMD:</strong> Pengguna disarankan memperbarui password sementara pada menu profil setelah pertama kali berhasil masuk ke dalam portal.
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
