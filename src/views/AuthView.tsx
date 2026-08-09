import React, { useState } from 'react';
import { FileText, LogIn, UserPlus, Check, Sparkles, Mail, Lock, User as UserIcon, Globe, Utensils } from 'lucide-react';
import { User } from '../types';

interface AuthViewProps {
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
  onLogout: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  currentUser,
  onLoginSuccess,
  onLogout
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Por favor informe seu e-mail.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        onLoginSuccess(json.user);
      } else {
        throw new Error(json.error || 'Erro na autenticação.');
      }
    } catch (err: any) {
      console.error('Erro de autenticação:', err);
      setErrorMsg(err.message || 'Erro ao conectar ao servidor de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@fiscal.ai' })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onLoginSuccess(json.user);
      }
    } catch (err) {
      console.error('Demo error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-2xl shadow-xs text-center space-y-4">
        <div className="w-16 h-16 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold border border-teal-200">
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{currentUser.name}</h2>
          <p className="text-xs text-slate-500">{currentUser.email}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-teal-700 font-mono">
          Sessão ativa com armazenamento de notas sincronizado no servidor.
        </div>
        <button
          onClick={onLogout}
          className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-colors"
        >
          Sair da Conta
        </button>
      </div>
    );
  }

  return (
    <div id="auth-view-container" className="max-w-md mx-auto my-8 px-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        
        {/* Brand Top */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center mx-auto shadow-xs border-[3px] border-amber-500 relative overflow-hidden mb-4">
            <Globe className="w-11 h-11 text-white/90 absolute opacity-80" />
            <div className="absolute inset-0 flex items-center justify-between px-2">
              <Utensils className="w-4 h-4 text-amber-400" />
              <Utensils className="w-4 h-4 text-amber-400 transform scale-x-[-1]" />
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {isRegisterMode ? 'Criar Conta' : 'Acessar Sabores e Nações'}
          </h1>
          <p className="text-xs text-slate-500">
            Gestão inteligente de notas fiscais
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {isRegisterMode && (
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Nome Completo</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-600 mb-1 font-medium">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-medium">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? 'Aguarde...' : isRegisterMode ? 'Cadastrar e Entrar' : 'Entrar'}
          </button>
        </form>

        {/* Demo Login Button */}
        <div className="pt-2 border-t border-slate-200 space-y-3">
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-teal-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Entrar como Usuário Demo (1-Clique)
          </button>

          <div className="text-center text-xs text-slate-500">
            {isRegisterMode ? 'Já possui conta?' : 'Ainda não tem conta?'}
            <button
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              className="text-teal-600 hover:underline font-semibold ml-1.5"
            >
              {isRegisterMode ? 'Fazer Login' : 'Criar Cadastro'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
