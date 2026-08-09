import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Building2, Calendar, FileText, DollarSign, Edit3, 
  Trash2, ShieldCheck, AlertTriangle, CheckCircle2, Eye, ExternalLink, Image as ImageIcon
} from 'lucide-react';
import { Receipt } from '../types';

interface ReceiptDetailViewProps {
  receiptId: string;
  onBack: () => void;
  onEdit: (receipt: Receipt) => void;
  onDelete: (receiptId: string) => void;
}

export const ReceiptDetailView: React.FC<ReceiptDetailViewProps> = ({
  receiptId,
  onBack,
  onEdit,
  onDelete
}) => {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  useEffect(() => {
    const fetchReceiptDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/receipts/${receiptId}`);
        const json = await res.json();
        if (res.ok && json.success) {
          setReceipt(json.receipt);
        } else {
          throw new Error(json.error || 'Nota fiscal não encontrada.');
        }
      } catch (err: any) {
        console.error('Erro ao carregar detalhes:', err);
        setError(err.message || 'Erro ao carregar os detalhes da nota.');
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptDetail();
  }, [receiptId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-500 text-xs animate-pulse">
        Carregando detalhes da nota fiscal...
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Erro ao carregar Nota Fiscal</h2>
        <p className="text-xs text-slate-500">{error || 'Nota fiscal não encontrada.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold"
        >
          Voltar para Histórico
        </button>
      </div>
    );
  }

  return (
    <div id="receipt-detail-container" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Top Header Controls */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <button
          id="btn-back-to-list"
          onClick={onBack}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-teal-600" />
          Voltar para Lista
        </button>

        <div className="flex items-center gap-2">
          <button
            id="btn-edit-receipt"
            onClick={() => onEdit(receipt)}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Editar Nota
          </button>

          <button
            id="btn-delete-receipt-detail"
            onClick={() => {
              if (confirm('Deseja realmente remover esta nota fiscal?')) {
                onDelete(receipt.id);
              }
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
            title="Excluir Nota"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Math Review Banner */}
      {receipt.requiresReview ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-2 text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Atenção: Esta nota fiscal requer revisão matemática</span>
          </div>
          <ul className="list-disc list-inside font-mono text-[11px] text-rose-800">
            {receipt.divergences?.map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Validação Matemática OK: Todos os itens e totais estão em conformidade.</span>
        </div>
      )}

      {/* Main Detail Header Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">{receipt.documentType} Nº {receipt.documentNumber || '000'}</div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">{receipt.issuerName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{receipt.fantasyName} • CNPJ/CPF: {receipt.taxId}</p>
          </div>

          <div className="text-left sm:text-right bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
            <div className="text-[10px] uppercase text-slate-500 font-bold">Valor Total Final</div>
            <div className="text-2xl font-extrabold text-teal-700 font-mono">
              R$ {(Number(receipt.totalAmount) || 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Pagamento: {receipt.paymentMethod}</div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px]">Data & Hora Emissão:</span>
            <span className="text-slate-800 font-semibold">{receipt.date} às {receipt.time || '12:00'}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px]">Valor Bruto:</span>
            <span className="text-slate-800 font-mono font-semibold">R$ {(Number(receipt.grossAmount) || 0).toFixed(2)}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px]">Descontos:</span>
            <span className="text-amber-700 font-mono font-semibold">R$ {(Number(receipt.discounts) || 0).toFixed(2)}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px]">Impostos Declarados:</span>
            <span className="text-slate-800 font-mono font-semibold">R$ {(Number(receipt.taxesAmount) || 0).toFixed(2)}</span>
          </div>
        </div>

      </div>

      {/* Items Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center justify-between">
          <span>Itens Discriminados ({receipt.items?.length || 0})</span>
          <span className="text-xs text-slate-500 font-normal">Origem: {receipt.source?.toUpperCase()}</span>
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-2.5 text-center">#</th>
                <th className="p-2.5">Descrição Normalizada</th>
                <th className="p-2.5">Categoria</th>
                <th className="p-2.5 text-right">Qtd / Un</th>
                <th className="p-2.5 text-right">Preço Un.</th>
                <th className="p-2.5 text-right">Desconto</th>
                <th className="p-2.5 text-right">Total Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {receipt.items?.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 text-center text-slate-400 font-bold">{item.sequence || idx + 1}</td>
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-900">{item.normalizedDescription}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{item.originalDescription}</div>
                  </td>
                  <td className="p-2.5 font-sans">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                      {item.category}
                    </span>
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-800">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="p-2.5 text-right text-slate-800">
                    R$ {(Number(item.unitPrice) || 0).toFixed(2)}
                  </td>
                  <td className="p-2.5 text-right text-amber-700">
                    R$ {(Number(item.discount) || 0).toFixed(2)}
                  </td>
                  <td className="p-2.5 text-right text-teal-700 font-bold">
                    R$ {(Number(item.totalPrice) || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image Preview Thumbnail */}
      {receipt.imageUrl && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-teal-600" />
              Documento Imagem Original
            </h3>
            <button
              onClick={() => setIsImageModalOpen(true)}
              className="text-xs text-teal-700 hover:underline flex items-center gap-1 font-medium"
            >
              <Eye className="w-3.5 h-3.5" /> Ampliar
            </button>
          </div>

          <div 
            onClick={() => setIsImageModalOpen(true)}
            className="w-full max-h-64 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center p-2"
          >
            <img src={receipt.imageUrl} alt="Nota Fiscal" className="max-h-60 object-contain rounded" />
          </div>
        </div>
      )}

      {/* Image Modal */}
      {isImageModalOpen && receipt.imageUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col p-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 text-white border-b border-slate-700">
            <h3 className="font-bold text-sm">Visualização da Imagem Original</h3>
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="px-3 py-1 bg-slate-800 text-slate-200 rounded-lg text-xs"
            >
              Fechar
            </button>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img src={receipt.imageUrl} alt="Nota Fiscal Ampliada" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}

    </div>
  );
};
