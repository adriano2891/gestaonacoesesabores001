import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Calendar, DollarSign, FileText, Trash2, Eye, 
  AlertTriangle, CheckCircle2, ChevronRight, PieChart, Sparkles, Plus, ArrowUpDown
} from 'lucide-react';
import { Receipt, FilterOptions } from '../types';

interface ReceiptsListViewProps {
  userId: string;
  onSelectReceipt: (receiptId: string) => void;
  onNewCapture: () => void;
}

export const ReceiptsListView: React.FC<ReceiptsListViewProps> = ({
  userId,
  onSelectReceipt,
  onNewCapture
}) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    startDate: '',
    endDate: '',
    supplier: '',
    currency: 'ALL',
    category: 'ALL',
    status: 'ALL'
  });
  
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/receipts?userId=${userId}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.success) {
        setReceipts(json.receipts || []);
      } else {
        throw new Error(json.error || 'Erro ao carregar lista de notas.');
      }
    } catch (err: any) {
      console.error('Erro ao buscar notas:', err);
      setError('Não foi possível carregar as notas salvas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [userId]);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setReceiptToDelete(id);
  };

  const confirmDelete = async () => {
    if (!receiptToDelete) return;
    try {
      const res = await fetch(`/api/receipts/${receiptToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setReceipts((prev) => prev.filter((r) => r.id !== receiptToDelete));
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setReceiptToDelete(null);
    }
  };

  const cancelDelete = () => {
    setReceiptToDelete(null);
  };

  // Filter application
  const filteredReceipts = receipts.filter((r) => {
    // Search filter
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const matchIssuer = (r.issuerName || '').toLowerCase().includes(term);
      const matchTaxId = (r.taxId || '').toLowerCase().includes(term);
      const matchDoc = (r.documentNumber || '').toLowerCase().includes(term);
      if (!matchIssuer && !matchTaxId && !matchDoc) return false;
    }

    // Date filters
    if (filters.startDate && r.date < filters.startDate) return false;
    if (filters.endDate && r.date > filters.endDate) return false;

    // Currency filter
    if (filters.currency !== 'ALL' && r.currency !== filters.currency) return false;

    // Status filter
    if (filters.status !== 'ALL') {
      if (filters.status === 'revisao_pendente' && !r.requiresReview) return false;
      if (filters.status === 'confirmada' && r.requiresReview) return false;
    }

    return true;
  });

  // Calculate Consolidated Metrics
  const totalSpent = filteredReceipts.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
  const totalTaxes = filteredReceipts.reduce((acc, r) => acc + (Number(r.taxesAmount) || 0), 0);
  const pendingCount = filteredReceipts.filter((r) => r.requiresReview).length;

  return (
    <div id="receipts-list-container" className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Top Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Histórico de Notas Fiscais</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie, filtre e visualize o acervo consolidado de cupons e faturas salvas
          </p>
        </div>

        <button
          id="btn-new-capture-from-list"
          onClick={onNewCapture}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Captura
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Consolidado</div>
          <div className="text-xl sm:text-2xl font-extrabold text-teal-700 mt-1 font-mono">
            R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{filteredReceipts.length} notas no filtro</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Quantidade Salva</div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            {filteredReceipts.length} <span className="text-xs text-slate-500 font-normal">notas</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Acervo do usuário</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Impostos Discriminados</div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1 font-mono">
            R$ {totalTaxes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">ICMS / Trib. declarados</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Requerem Revisão</div>
          <div className={`text-xl sm:text-2xl font-extrabold mt-1 ${pendingCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {pendingCount} <span className="text-xs text-slate-500 font-normal">pendentes</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Alertas de divergência</div>
        </div>

      </div>

      {/* Filter Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-200">
          <Filter className="w-3.5 h-3.5 text-teal-600" />
          <span>Filtros de Pesquisa</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          
          {/* Search text */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Buscar por Fornecedor, CNPJ ou Nº Nota..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
            >
              <option value="ALL">Todos os Status</option>
              <option value="confirmada">Confirmadas (Sem Erro)</option>
              <option value="revisao_pendente">Revisão Pendente</option>
            </select>
          </div>

        </div>
      </div>

      {/* Receipts Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs animate-pulse">
            Carregando notas salvas...
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <FileText className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-800">Nenhuma nota fiscal encontrada</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Nenhuma nota corresponde aos filtros atuais. Tente alterar os parâmetros ou capture uma nova nota.
            </p>
            <button
              onClick={onNewCapture}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Capturar Primeira Nota
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Fornecedor / Emitente</th>
                  <th className="p-3">CNPJ / CPF</th>
                  <th className="p-3">Tipo / Nº</th>
                  <th className="p-3 text-right">Itens</th>
                  <th className="p-3 text-right">Valor Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceipts.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onSelectReceipt(r.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {r.date || '---'}
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                        {r.issuerName || 'Emitente Desconhecido'}
                      </div>
                      <div className="text-[10px] text-slate-400">{r.fantasyName}</div>
                    </td>

                    <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                      {r.taxId || '---'}
                    </td>

                    <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold mr-1.5">
                        {r.documentType || 'NF'}
                      </span>
                      {r.documentNumber || 'N/A'}
                    </td>

                    <td className="p-3 text-right font-mono text-slate-500">
                      {r.items?.length || 0}
                    </td>

                    <td className="p-3 text-right font-mono font-extrabold text-teal-700 whitespace-nowrap">
                      R$ {(Number(r.totalAmount) || 0).toFixed(2)}
                    </td>

                    <td className="p-3 text-center">
                      {r.requiresReview ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Revisão Pendente
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Confirmada
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReceipt(r.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-teal-700 rounded hover:bg-slate-100 transition-colors"
                          title="Detalhar Nota"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={(e) => handleDeleteClick(e, r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                          title="Excluir Nota"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Excluir Nota Fiscal</h3>
              <p className="text-sm text-slate-500">
                Tem certeza que deseja excluir esta nota fiscal do histórico? Esta ação não poderá ser desfeita.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors text-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
