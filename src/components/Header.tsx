import React from 'react';
import { FileText, Camera, List, LogIn, User as UserIcon, ShieldCheck, Zap } from 'lucide-react';
import { User, ReadingMode } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  readingMode: ReadingMode;
  setReadingMode: (mode: ReadingMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  readingMode,
  setReadingMode
}) => {
  return (
    <header id="main-header" className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          id="brand-logo" 
          onClick={() => setActiveTab('capture')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs group-hover:bg-teal-700 transition-colors">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xl tracking-tight text-slate-900">Fiscal<span className="text-teal-600">AI</span></span>
              <span className="text-[10px] uppercase font-semibold tracking-widest px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">PT-BR</span>
            </div>
            <p className="text-xs text-slate-500 -mt-0.5">Captura & Extração de Notas</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav id="header-nav" className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            id="nav-btn-capture"
            onClick={() => setActiveTab('capture')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'capture'
                ? 'bg-white text-teal-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Camera className="w-4 h-4 text-teal-600" />
            Nova Captura
          </button>

          <button
            id="nav-btn-receipts"
            onClick={() => setActiveTab('receipts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'receipts'
                ? 'bg-white text-teal-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <List className="w-4 h-4 text-teal-600" />
            Minhas Notas
          </button>
        </nav>

        {/* Mode Selector & Auth */}
        <div className="flex items-center gap-3">
          
          {/* Mode Switcher Pill */}
          <div className="hidden sm:flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs font-medium">
            <button
              id="mode-normal-btn"
              onClick={() => setReadingMode('normal')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                readingMode === 'normal'
                  ? 'bg-white text-teal-700 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="1 imagem por extração"
            >
              <Zap className="w-3 h-3 text-teal-600" />
              Normal
            </button>
            <button
              id="mode-intensive-btn"
              onClick={() => setReadingMode('intensive')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                readingMode === 'intensive'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Consolida várias fotos/páginas em 1 chamada única"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Intensivo
            </button>
          </div>

          {/* User Auth Info / Login */}
          {currentUser ? (
            <div id="user-profile-menu" className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div 
                onClick={() => setActiveTab('auth')} 
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs border border-teal-200">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    currentUser.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-500 leading-tight truncate max-w-[120px]">{currentUser.email}</div>
                </div>
              </div>
              <button
                id="logout-btn"
                onClick={onLogout}
                className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                title="Sair da conta"
              >
                Sair
              </button>
            </div>
          ) : (
            <button
              id="login-nav-btn"
              onClick={() => setActiveTab('auth')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5 text-teal-600" />
              Entrar
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t border-slate-200 bg-slate-50 px-2 py-1.5 justify-around text-xs">
        <button
          onClick={() => setActiveTab('capture')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md ${
            activeTab === 'capture' ? 'bg-teal-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          <Camera className="w-4 h-4" />
          Nova Captura
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md ${
            activeTab === 'receipts' ? 'bg-teal-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          <List className="w-4 h-4" />
          Minhas Notas
        </button>
        <button
          onClick={() => setActiveTab('auth')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md ${
            activeTab === 'auth' ? 'bg-teal-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          {currentUser ? 'Conta' : 'Login'}
        </button>
      </div>
    </header>
  );
};
