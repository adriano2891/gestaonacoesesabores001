import React, { useState } from 'react';
import { 
  CheckCircle2, AlertTriangle, Save, Trash2, Plus, RefreshCw, 
  Eye, FileText, Calculator, ShieldAlert, Sparkles, Building2, Calendar, DollarSign
} from 'lucide-react';
import { Receipt, ReceiptItem, Category, DocumentType, PaymentMethod, TaxIdType } from '../types';

interface ReviewViewProps {
  initialData: Omit<Receipt, 'id' | 'createdAt'>;
  onSave: (receipt: Receipt) => void;
  onDiscard: () => void;
}

const CATEGORIES: Category[] = [
  'Alimentação', 'Supermercado', 'Transporte', 'Combustível', 
  'Saúde', 'Serviços', 'Escritório', 'Outros'
];

const DOC_TYPES: DocumentType[] = ['NFC-e', 'NF-e', 'SAT', 'Cupom Fiscal', 'Recibo', 'Outro'];
const PAYMENT_METHODS: PaymentMethod[] = ['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Boleto', 'Outro'];

export const ReviewView: React.FC<ReviewViewProps> = ({
  initialData,
  onSave,
  onDiscard
}) => {
  const [receipt, setReceipt] = useState<Omit<Receipt, 'id' | 'createdAt'>>({
    ...initialData,
    items: initialData.items || []
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Recalculate mathematical divergences in real-time as user edits values
  const recalculateMath = (updated: Omit<Receipt, 'id' | 'createdAt'>) => {
    const divergences: string[] = [];
    const items = updated.items || [];

    const itemsSum = items.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
    const grossAmount = Number(updated.grossAmount) || 0;
    
    if (Math.abs(itemsSum - grossAmount) > 0.02) {
      divergences.push(
        `A soma do valor total dos itens (R$ ${itemsSum.toFixed(2)}) difere do Valor Bruto (R$ ${grossAmount.toFixed(2)}).`
      );
    }

    const discounts = Number(updated.discounts) || 0;
    const taxesAmount = Number(updated.taxesAmount) || 0;
    const totalAmount = Number(updated.totalAmount) || 0;

    const calc1 = grossAmount - discounts;
    const calc2 = grossAmount - discounts + taxesAmount;

    if (Math.abs(calc1 - totalAmount) > 0.02 && Math.abs(calc2 - totalAmount) > 0.02) {
      divergences.push(
        `Cálculo do total (Bruto R$ ${grossAmount.toFixed(2)} - Desconto R$ ${discounts.toFixed(2)}) = R$ ${calc1.toFixed(2)} difere do Total da Nota (R$ ${totalAmount.toFixed(2)}).`
      );
    }

    items.forEach((it, idx) => {
      const q = Number(it.quantity) || 0;
      const up = Number(it.unitPrice) || 0;
      const disc = Number(it.discount) || 0;
      const tp = Number(it.totalPrice) || 0;
      const calcItem = (q * up) - disc;

      if (Math.abs(calcItem - tp) > 0.02 && q > 0 && up > 0) {
        divergences.push(
          `Item ${it.sequence || idx + 1} (${it.originalDescription || 'Produto'}): Qtd (${q}) × Preço (R$ ${up.toFixed(2)}) - Desc (R$ ${disc.toFixed(2)}) = R$ ${calcItem.toFixed(2)}, mas o Total é R$ ${tp.toFixed(2)}.`
        );
      }
    });

    return {
      requiresReview: divergences.length > 0,
      divergences
    };
  };

  // Header change handler
  const handleHeaderChange = (field: keyof Omit<Receipt, 'id' | 'createdAt' | 'items'>, value: any) => {
    const updated = { ...receipt, [field]: value };
    const math = recalculateMath(updated);
    setReceipt({
      ...updated,
      requiresReview: math.requiresReview,
      divergences: math.divergences,
      status: math.requiresReview ? 'revisao_pendente' : 'confirmada'
    });
  };

  // Item change handler
  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    const newItems = [...receipt.items];
    const targetItem = { ...newItems[index], [field]: value };

    // Auto calculate item totalPrice if quantity or unitPrice changes
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
      const q = Number(field === 'quantity' ? value : targetItem.quantity) || 0;
      const up = Number(field === 'unitPrice' ? value : targetItem.unitPrice) || 0;
      const disc = Number(field === 'discount' ? value : targetItem.discount) || 0;
      targetItem.totalPrice = Math.max(0, (q * up) - disc);
    }

    newItems[index] = targetItem;
    const updated = { ...receipt, items: newItems };

    // Auto adjust gross amount if items total changed
    const newGrossSum = newItems.reduce((a, b) => a + (Number(b.totalPrice) || 0), 0);
    updated.grossAmount = newGrossSum;
    updated.totalAmount = Math.max(0, newGrossSum - (Number(updated.discounts) || 0));

    const math = recalculateMath(updated);
    setReceipt({
      ...updated,
      requiresReview: math.requiresReview,
      divergences: math.divergences,
      status: math.requiresReview ? 'revisao_pendente' : 'confirmada'
    });
  };

  // Add Item
  const handleAddItem = () => {
    const newItem: ReceiptItem = {
      sequence: receipt.items.length + 1,
      originalDescription: 'NOVO ITEM',
      normalizedDescription: 'NOVO ITEM',
      category: 'Outros',
      quantity: 1,
      unit: 'UN',
      unitPrice: 0,
      discount: 0,
      totalPrice: 0
    };
    const newItems = [...receipt.items, newItem];
    const updated = { ...receipt, items: newItems };
    setReceipt(updated);
  };

  // Delete Item
  const handleDeleteItem = (index: number) => {
    const newItems = receipt.items.filter((_, i) => i !== index);
    const updated = {
      ...receipt,
      items: newItems.map((it, idx) => ({ ...it, sequence: idx + 1 }))
    };
    const math = recalculateMath(updated);
    setReceipt({
      ...updated,
      requiresReview: math.requiresReview,
      divergences: math.divergences
    });
  };

  // Save Receipt to DB
  const handleSaveReceipt = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...receipt,
          id: `rec-${Date.now()}`,
          createdAt: new Date().toISOString()
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao salvar nota fiscal.');
      }

      setIsSaving(false);
      onSave(json.receipt);
    } catch (err: any) {
      console.error('Erro ao salvar nota:', err);
      alert(err.message || 'Erro ao salvar a nota fiscal no banco de dados.');
      setIsSaving(false);
    }
  };

  const confidencePct = Math.round((receipt.confidence || 0.85) * 100);

  return (
    <div id="review-view-container" className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Top Banner & Confidence Badge */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Revisão & Edição do Documento</h1>
            
            {/* Confidence Badge */}
            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
              confidencePct >= 85
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : confidencePct >= 60
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <Sparkles className="w-3.5 h-3.5" />
              Confiança IA: {confidencePct}% ({confidencePct >= 85 ? 'Alta' : confidencePct >= 60 ? 'Média' : 'Baixa'})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Confira e edite os dados extraídos. As divergências numéricas são calculadas automaticamente em tempo real.
          </p>
        </div>

        {receipt.imageUrl && (
          <button
            id="view-original-image-btn"
            onClick={() => setIsPreviewOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-teal-700 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-200 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Ver Imagem Original
          </button>
        )}
      </div>

      {/* Divergence Alert Banner */}
      {receipt.requiresReview && (
        <div id="divergence-alert-banner" className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 text-rose-900 shadow-xs space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Alerta de Divergência Matemática ({receipt.divergences?.length || 1})</span>
          </div>
          <p className="text-xs text-rose-800">
            Encontramos inconsistências numéricas nos totais ou nos itens. Esta nota está marcada como "requer revisão". Corrija os valores abaixo para validar.
          </p>
          <ul className="list-disc list-inside text-xs space-y-1 font-mono text-rose-800 pt-1">
            {receipt.divergences?.map((div, i) => (
              <li key={i}>{div}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Header Fields Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          Cabeçalho do Documento Fiscal
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          
          <div>
            <label className="block text-slate-600 mb-1 font-medium">Razão Social (Emitente)</label>
            <input
              type="text"
              value={receipt.issuerName || ''}
              onChange={(e) => handleHeaderChange('issuerName', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-medium focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-medium">Nome Fantasia</label>
            <input
              type="text"
              value={receipt.fantasyName || ''}
              onChange={(e) => handleHeaderChange('fantasyName', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-medium focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-medium">CNPJ / CPF Emitente</label>
            <input
              type="text"
              value={receipt.taxId || ''}
              onChange={(e) => handleHeaderChange('taxId', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-medium">Tipo do Documento</label>
            <select
              value={receipt.documentType}
              onChange={(e) => handleHeaderChange('documentType', e.target.value as DocumentType)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-medium focus:border-teal-600 focus:bg-white focus:outline-none"
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-medium">Nº do Documento</label>
            <input
              type="text"
              value={receipt.documentNumber || ''}
              onChange={(e) => handleHeaderChange('documentNumber', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-medium">Data Emissão</label>
            <input
              type="date"
              value={receipt.date || ''}
              onChange={(e) => handleHeaderChange('date', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-medium focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-medium">Forma de Pagamento</label>
            <select
              value={receipt.paymentMethod}
              onChange={(e) => handleHeaderChange('paymentMethod', e.target.value as PaymentMethod)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-medium focus:border-teal-600 focus:bg-white focus:outline-none"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-medium">Moeda</label>
            <select
              value={receipt.currency}
              onChange={(e) => handleHeaderChange('currency', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-medium focus:border-teal-600 focus:bg-white focus:outline-none"
            >
              <option value="BRL">BRL (R$)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

        </div>

        {/* Financial Summary Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-slate-600 text-[11px] font-medium">Valor Bruto (R$)</label>
            <input
              type="number"
              step="0.01"
              value={receipt.grossAmount || 0}
              onChange={(e) => handleHeaderChange('grossAmount', parseFloat(e.target.value) || 0)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 font-bold text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 text-[11px] font-medium">Descontos (R$)</label>
            <input
              type="number"
              step="0.01"
              value={receipt.discounts || 0}
              onChange={(e) => handleHeaderChange('discounts', parseFloat(e.target.value) || 0)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-amber-700 font-bold text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 text-[11px] font-medium">Impostos / Tributos (R$)</label>
            <input
              type="number"
              step="0.01"
              value={receipt.taxesAmount || 0}
              onChange={(e) => handleHeaderChange('taxesAmount', parseFloat(e.target.value) || 0)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-bold text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-teal-700 text-[11px] font-semibold">Valor Total Líquido (R$)</label>
            <input
              type="number"
              step="0.01"
              value={receipt.totalAmount || 0}
              onChange={(e) => handleHeaderChange('totalAmount', parseFloat(e.target.value) || 0)}
              className="w-full bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 text-teal-900 font-extrabold text-base focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Items Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-600" />
              Tabela de Itens ({receipt.items.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Edite os preços, quantidades e categorias de cada item</p>
          </div>

          <button
            id="add-item-btn"
            onClick={handleAddItem}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Item
          </button>
        </div>

        {/* Editable Dense Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-10 text-center">#</th>
                <th className="p-2.5 min-w-[180px]">Descrição Impressa</th>
                <th className="p-2.5 min-w-[180px]">Descrição Normalizada</th>
                <th className="p-2.5 min-w-[130px]">Categoria</th>
                <th className="p-2.5 w-16 text-right">Qtd</th>
                <th className="p-2.5 w-16">Unid</th>
                <th className="p-2.5 w-24 text-right">Preço Un.</th>
                <th className="p-2.5 w-20 text-right">Desc.</th>
                <th className="p-2.5 w-24 text-right">Total</th>
                <th className="p-2.5 w-10 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-mono">
              {receipt.items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  
                  <td className="p-2 text-center text-slate-400 font-bold">{index + 1}</td>
                  
                  <td className="p-1">
                    <input
                      type="text"
                      value={item.originalDescription}
                      onChange={(e) => handleItemChange(index, 'originalDescription', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
                    />
                  </td>

                  <td className="p-1">
                    <input
                      type="text"
                      value={item.normalizedDescription}
                      onChange={(e) => handleItemChange(index, 'normalizedDescription', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
                    />
                  </td>

                  <td className="p-1">
                    <select
                      value={item.category}
                      onChange={(e) => handleItemChange(index, 'category', e.target.value as Category)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-900 font-sans focus:bg-white focus:border-teal-600 focus:outline-none"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>

                  <td className="p-1">
                    <input
                      type="number"
                      step="0.001"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-right text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
                    />
                  </td>

                  <td className="p-1">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleItemChange(index, 'unit', e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-900 uppercase focus:bg-white focus:border-teal-600 focus:outline-none"
                    />
                  </td>

                  <td className="p-1">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-right text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
                    />
                  </td>

                  <td className="p-1">
                    <input
                      type="number"
                      step="0.01"
                      value={item.discount}
                      onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-right text-amber-700 focus:bg-white focus:border-teal-600 focus:outline-none"
                    />
                  </td>

                  <td className="p-1">
                    <input
                      type="number"
                      step="0.01"
                      value={item.totalPrice}
                      onChange={(e) => handleItemChange(index, 'totalPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-right text-teal-700 font-bold focus:bg-white focus:border-teal-600 focus:outline-none"
                    />
                  </td>

                  <td className="p-1 text-center">
                    <button
                      onClick={() => handleDeleteItem(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                      title="Excluir Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          id="discard-receipt-btn"
          onClick={onDiscard}
          className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 border border-slate-200"
        >
          <Trash2 className="w-4 h-4 text-rose-600" />
          Descartar
        </button>

        <button
          id="save-receipt-btn"
          onClick={handleSaveReceipt}
          disabled={isSaving}
          className="px-7 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Nota Fiscal
        </button>
      </div>

      {/* Original Image Modal */}
      {isPreviewOpen && receipt.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 text-white">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              Documento Fiscal Original
            </h3>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="px-3 py-1 bg-slate-800 text-slate-200 rounded-lg text-xs"
            >
              Fechar
            </button>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-2">
            <img
              src={receipt.imageUrl}
              alt="Nota Fiscal Original"
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-800 shadow-2xl"
            />
          </div>
        </div>
      )}

    </div>
  );
};
