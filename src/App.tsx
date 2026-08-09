import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CaptureView } from './views/CaptureView';
import { ReviewView } from './views/ReviewView';
import { ReceiptsListView } from './views/ReceiptsListView';
import { ReceiptDetailView } from './views/ReceiptDetailView';
import { AuthView } from './views/AuthView';
import { ReportsView } from './views/ReportsView';
import { User, ReadingMode, Receipt } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('capture');
  const [readingMode, setReadingMode] = useState<ReadingMode>('normal');
  
  // User Session
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('fiscal_ai_user');
      return saved ? JSON.parse(saved) : { id: 'usr-1', name: 'Usuário Demo', email: 'demo@fiscal.ai' };
    } catch {
      return { id: 'usr-1', name: 'Usuário Demo', email: 'demo@fiscal.ai' };
    }
  });

  // Extraction payload waiting for review
  const [extractedPayload, setExtractedPayload] = useState<Omit<Receipt, 'id' | 'createdAt'> | null>(null);

  // Selected receipt ID for detail view
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('fiscal_ai_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('fiscal_ai_user');
    }
  }, [currentUser]);

  // When extraction succeeds from CaptureView
  const handleExtractionSuccess = (data: Omit<Receipt, 'id' | 'createdAt'>) => {
    setExtractedPayload(data);
    setActiveTab('revisao');
  };

  // When saved from ReviewView
  const handleReceiptSaved = (savedReceipt: Receipt) => {
    setExtractedPayload(null);
    setSelectedReceiptId(savedReceipt.id);
    setActiveTab('receipt_detail');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('auth');
  };

  return (
    <div id="fiscal-ai-app" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      
      {/* Persistent Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab !== 'revisao') setExtractedPayload(null);
          setActiveTab(tab);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        readingMode={readingMode}
        setReadingMode={setReadingMode}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'capture' && (
          <CaptureView
            readingMode={readingMode}
            setReadingMode={setReadingMode}
            onExtractionSuccess={handleExtractionSuccess}
            userId={currentUser?.id || 'usr-guest'}
          />
        )}

        {activeTab === 'revisao' && extractedPayload && (
          <ReviewView
            initialData={extractedPayload}
            onSave={handleReceiptSaved}
            onDiscard={() => {
              setExtractedPayload(null);
              setActiveTab('capture');
            }}
          />
        )}

        {activeTab === 'receipts' && (
          <ReceiptsListView
            userId={currentUser?.id || 'usr-guest'}
            onSelectReceipt={(id) => {
              setSelectedReceiptId(id);
              setActiveTab('receipt_detail');
            }}
            onNewCapture={() => setActiveTab('capture')}
          />
        )}

        {activeTab === 'receipt_detail' && selectedReceiptId && (
          <ReceiptDetailView
            receiptId={selectedReceiptId}
            onBack={() => setActiveTab('receipts')}
            onEdit={(receiptToEdit) => {
              setExtractedPayload(receiptToEdit);
              setActiveTab('revisao');
            }}
            onDelete={() => {
              setActiveTab('receipts');
            }}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView userId={currentUser?.id || 'usr-guest'} />
        )}

        {activeTab === 'auth' && (
          <AuthView
            currentUser={currentUser}
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              setActiveTab('capture');
            }}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-700">FiscalAI</span> — Captura & Extração de Notas Fiscais PT-BR
          </div>
          <div className="text-[11px] text-slate-500">
            Powered by Gemini AI • Visão Computacional & Validação Numérica
          </div>
        </div>
      </footer>

    </div>
  );
}
