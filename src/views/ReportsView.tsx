import React, { useState, useEffect, useMemo } from 'react';
import { Receipt } from '../types';
import { FileDown, FileText, Search, Filter, AlertTriangle, Calendar as CalendarIcon, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  format, 
  parseISO, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  isWithinInterval,
  parse
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportsViewProps {
  userId: string;
}

type PeriodType = 'todos' | 'diario' | 'semanal' | 'mensal' | 'anual' | 'personalizado';

export const ReportsView: React.FC<ReportsViewProps> = ({ userId }) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [period, setPeriod] = useState<PeriodType>('todos');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadReceipts();
  }, [userId]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/receipts?userId=${userId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao buscar as notas do servidor.');
      const json = await res.json();
      const loadedReceipts = json.receipts || [];
      console.log(`Loaded ${loadedReceipts.length} receipts for user ${userId}`);
      setReceipts(loadedReceipts);
    } catch (err: any) {
      console.error('Failed to load receipts for reports', err);
      setError(err.message || 'Ocorreu um erro ao carregar os relatórios.');
    } finally {
      setLoading(false);
    }
  };

  const toggleReceiptSelection = (id: string) => {
    const newSet = new Set(selectedReceiptIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedReceiptIds(newSet);
  };

  const handleSelectAll = () => {
    const allIds = filteredReceipts.map(r => r.id);
    setSelectedReceiptIds(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedReceiptIds(new Set());
  };

  // Helper to parse date from receipt string (YYYY-MM-DD or DD/MM/YYYY)
  const parseReceiptDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('/')) {
      return parse(dateStr, 'dd/MM/yyyy', new Date());
    }
    return parseISO(dateStr);
  };

  // Filtering Logic
  const filteredReceipts = useMemo(() => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    if (period === 'todos') {
      startDate = new Date(2000, 0, 1);
      endDate = new Date(2100, 0, 1);
    } else if (period === 'diario') {
      startDate = startOfDay(today);
      endDate = endOfDay(today);
    } else if (period === 'semanal') {
      startDate = startOfWeek(today, { locale: ptBR });
      endDate = endOfWeek(today, { locale: ptBR });
    } else if (period === 'mensal') {
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
    } else if (period === 'anual') {
      startDate = startOfYear(today);
      endDate = endOfYear(today);
    } else {
      startDate = customStart ? startOfDay(parseISO(customStart)) : new Date(2000, 0, 1);
      endDate = customEnd ? endOfDay(parseISO(customEnd)) : new Date(2100, 0, 1);
    }

    return receipts.filter((r) => {
      // 1. Period Filter
      if (period !== 'todos') {
        const rDate = parseReceiptDate(r.date);
        if (!isWithinInterval(rDate, { start: startDate, end: endDate })) return false;
      }

      // 2. Supplier Filter
      const supplierMatch = r.issuerName?.toLowerCase().includes(searchSupplier.toLowerCase()) || 
                            r.fantasyName?.toLowerCase().includes(searchSupplier.toLowerCase()) || 
                            r.taxId?.includes(searchSupplier);
      
      const docNumberMatch = r.documentNumber?.toLowerCase().includes(searchSupplier.toLowerCase());

      if (searchSupplier && !supplierMatch && !docNumberMatch) return false;

      // 3. Status Filter
      if (statusFilter === 'confirmada' && r.requiresReview) return false;
      if (statusFilter === 'pendente' && !r.requiresReview) return false;

      // 4. Value Range
      const totalAmount = Number(r.totalAmount) || 0;
      if (minValue && totalAmount < Number(minValue)) return false;
      if (maxValue && totalAmount > Number(maxValue)) return false;

      // 5. Product Filter
      if (searchProduct) {
        const hasMatchingProduct = r.items?.some(item => 
          item.originalDescription.toLowerCase().includes(searchProduct.toLowerCase()) || 
          item.normalizedDescription.toLowerCase().includes(searchProduct.toLowerCase())
        );
        if (!hasMatchingProduct) return false;
      }

      return true;
    });
  }, [receipts, period, customStart, customEnd, searchSupplier, statusFilter, minValue, maxValue, searchProduct]);

  const selectedReceiptsList = useMemo(() => {
    return filteredReceipts.filter(r => selectedReceiptIds.has(r.id));
  }, [filteredReceipts, selectedReceiptIds]);

  // Flatten items for the report
  const reportRows = useMemo(() => {
    const rows: any[] = [];
    selectedReceiptsList.forEach(r => {
      // If there's a product filter, we only include those items
      const itemsToInclude = searchProduct 
        ? r.items?.filter(item => 
            item.originalDescription.toLowerCase().includes(searchProduct.toLowerCase()) || 
            item.normalizedDescription.toLowerCase().includes(searchProduct.toLowerCase())
          )
        : r.items;

      (itemsToInclude || []).forEach(item => {
        rows.push({
          receiptId: r.id,
          date: r.date,
          time: r.time || '--:--',
          documentNumber: r.documentNumber || 'N/A',
          accessKey: r.accessKey || 'N/A',
          issuerName: r.issuerName || 'Desconhecido',
          taxId: r.taxId || 'N/A',
          product: item.normalizedDescription || item.originalDescription,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice) || 0,
          itemDiscount: Number(item.discount) || 0,
          itemTotal: Number(item.totalPrice) || 0,
          receiptTaxes: Number(r.taxesAmount) || 0,
          receiptTotal: Number(r.totalAmount) || 0,
          paymentMethod: r.paymentMethod || 'Outros',
          status: r.requiresReview ? 'Pendente' : 'Confirmada',
          rawDate: parseReceiptDate(r.date)
        });
      });
    });

    // Sort by date descending
    return rows.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [selectedReceiptsList, searchProduct]);

  // Calculations
  const metrics = useMemo(() => {
    let totalItems = 0;
    let sumDiscounts = 0;
    
    reportRows.forEach(row => {
      totalItems += 1;
      sumDiscounts += row.itemDiscount;
    });

    // We only sum receipt level things per distinct receipt
    let sumTaxes = 0;
    let sumTotalExpenses = 0;
    
    selectedReceiptsList.forEach(r => {
      sumTaxes += (Number(r.taxesAmount) || 0);
      sumTotalExpenses += (Number(r.totalAmount) || 0);
    });

    return {
      totalReceipts: selectedReceiptsList.length,
      totalItems,
      sumDiscounts,
      sumTaxes,
      sumTotalExpenses
    };
  }, [reportRows, selectedReceiptsList]);

  // Export to Excel
  const exportToExcel = () => {
    const wsData = reportRows.map(row => ({
      'Data Emissão': `${row.date} ${row.time}`,
      'Nº Nota': row.documentNumber,
      'Chave Acesso': row.accessKey,
      'Fornecedor': row.issuerName,
      'CNPJ/CPF': row.taxId,
      'Produto / Serviço': row.product,
      'Qtd': row.quantity,
      'Valor Un. (R$)': row.unitPrice,
      'Desconto (R$)': row.itemDiscount,
      'Total Item (R$)': row.itemTotal,
      'Impostos Nota (R$)': row.receiptTaxes,
      'Total Nota (R$)': row.receiptTotal,
      'Forma Pagamento': row.paymentMethod,
      'Status': row.status
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    
    // Add Totals row at the bottom
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      ['TOTAIS DO PERÍODO'],
      ['Qtd Notas', 'Qtd Itens', 'Soma Descontos (R$)', 'Soma Impostos (R$)', 'Total Despesas (R$)'],
      [
        metrics.totalReceipts, 
        metrics.totalItems, 
        metrics.sumDiscounts, 
        metrics.sumTaxes, 
        metrics.sumTotalExpenses
      ]
    ], { origin: -1 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_Notas');

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    XLSX.writeFile(wb, `relatorio-notas-${period}-${dateStr}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    
    const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');
    const title = `Relatório Consolidado de Notas Fiscais - ${period.toUpperCase()}`;

    // Helper for currency formatting
    const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    autoTable(doc, {
      head: [[
        'Data', 'Nota', 'Fornecedor', 'Produto', 'Qtd', 'V. Unit', 'Desc.', 'T. Item', 'Total Nota', 'Status'
      ]],
      body: reportRows.map(row => [
        `${row.date}`,
        row.documentNumber,
        row.issuerName.substring(0, 15) + (row.issuerName.length > 15 ? '...' : ''),
        row.product.substring(0, 20) + (row.product.length > 20 ? '...' : ''),
        row.quantity,
        formatCurrency(row.unitPrice),
        formatCurrency(row.itemDiscount),
        formatCurrency(row.itemTotal),
        formatCurrency(row.receiptTotal),
        row.status
      ]),
      startY: 30,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [13, 148, 136] }, // teal-600
      didDrawPage: (data) => {
        // Header
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(title, data.settings.margin.left, 15);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Gerado em: ${dateStr}`, data.settings.margin.left, 22);
        
        // Footer (Page numbers)
        const str = `Página ${(doc as any).internal.getNumberOfPages()}`;
        doc.setFontSize(8);
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, data.settings.margin.left, pageHeight - 10);
      }
    });

    // Totals Section
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Resumo do Período:', 14, finalY);
    
    doc.setFontSize(9);
    doc.text(`Total de Notas: ${metrics.totalReceipts}`, 14, finalY + 7);
    doc.text(`Total de Itens: ${metrics.totalItems}`, 14, finalY + 13);
    doc.text(`Soma de Descontos: ${formatCurrency(metrics.sumDiscounts)}`, 14, finalY + 19);
    doc.text(`Soma de Impostos: ${formatCurrency(metrics.sumTaxes)}`, 14, finalY + 25);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Valor Total das Despesas: ${formatCurrency(metrics.sumTotalExpenses)}`, 14, finalY + 33);

    const fileDateStr = format(new Date(), 'yyyy-MM');
    doc.save(`relatorio-notas-${period}-${fileDateStr}.pdf`);
  };

  return (
    <div id="reports-view-container" className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Relatórios e Exportação</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolide, filtre e exporte os dados detalhados das suas notas fiscais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={selectedReceiptIds.size === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button
            onClick={exportToPDF}
            disabled={selectedReceiptIds.size === 0}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-200">
          <Filter className="w-3.5 h-3.5 text-teal-600" />
          <span>Filtros do Relatório</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {/* Period */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
            >
              <option value="todos">Todos os tempos</option>
              <option value="diario">Diário (Hoje)</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {period === 'personalizado' && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Data Início</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
                />
              </div>
            </div>
          )}

          {/* Search Supplier */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fornecedor / CNPJ</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchSupplier}
                onChange={(e) => setSearchSupplier(e.target.value)}
                placeholder="Buscar fornecedor..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
              />
            </div>
          </div>

          {/* Search Product */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Produto / Serviço</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                placeholder="Buscar item..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status da Nota</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
            >
              <option value="ALL">Todos os Status</option>
              <option value="confirmada">Confirmada</option>
              <option value="pendente">Requer Revisão</option>
            </select>
          </div>

          {/* Min Value */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Valor Mín. (Nota)</label>
            <input
              type="number"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="R$ 0,00"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>

          {/* Max Value */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Valor Máx. (Nota)</label>
            <input
              type="number"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              placeholder="R$ 999,00"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>
        </div>
      </div>

      {/* Selection Area */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col max-h-[500px]">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-800">Selecionar Notas ({filteredReceipts.length} encontradas)</h3>
            <div className="flex gap-2">
              <button onClick={handleSelectAll} className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-md text-slate-700 font-medium transition-colors">
                Selecionar todas
              </button>
              <button onClick={handleClearSelection} className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-md text-slate-700 font-medium transition-colors">
                Limpar seleção
              </button>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-md">{selectedReceiptIds.size} selecionadas</span>
        </div>
        
        <div className="overflow-auto flex-1 p-4 bg-slate-50/50">
          {loading ? (
            <div className="text-center text-slate-500 py-8">Carregando notas salvas...</div>
          ) : error ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-rose-600 font-medium">{error}</div>
              <button 
                onClick={loadReceipts}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center text-slate-500 py-8">Nenhuma nota salva foi encontrada.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredReceipts.map(receipt => (
                <div 
                  key={receipt.id}
                  onClick={() => toggleReceiptSelection(receipt.id)}
                  className={`cursor-pointer border rounded-xl p-4 flex gap-3 transition-colors select-none ${
                    selectedReceiptIds.has(receipt.id) 
                      ? 'bg-teal-50 border-teal-500 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="mt-0.5">
                    <input 
                      type="checkbox" 
                      checked={selectedReceiptIds.has(receipt.id)}
                      readOnly
                      className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-600 cursor-pointer pointer-events-none"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate" title={receipt.issuerName || receipt.fantasyName || 'Desconhecido'}>
                        {receipt.issuerName || receipt.fantasyName || 'Desconhecido'}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                        receipt.requiresReview 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {receipt.requiresReview ? 'Pendente' : 'Confirmada'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex justify-between items-center">
                      <span className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5 text-slate-400" />{receipt.date}</span>
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200" title="Número da Nota">
                        #{receipt.documentNumber || 'N/A'}
                      </span>
                    </div>
                    <div className="text-xs flex justify-between items-center pt-1 border-t border-slate-100/60">
                      <span className={`font-medium flex items-center gap-1 ${!receipt.items?.length ? 'text-rose-500' : 'text-slate-500'}`}>
                        {!receipt.items?.length && <AlertTriangle className="w-3.5 h-3.5" />}
                        {receipt.items?.length || 0} {receipt.items?.length === 1 ? 'item' : 'itens'}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        R$ {(Number(receipt.totalAmount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Table & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Metrics Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              Resumo para Exportação
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Período Considerado</div>
                <div className="text-sm font-bold text-slate-900 capitalize">{period}</div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500 font-medium">Valor Total Consolidado</div>
                <div className="text-2xl font-extrabold text-teal-700 font-mono">
                  R$ {metrics.sumTotalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500 font-medium">Planilhas Selecionadas</div>
                <div className="text-lg font-bold text-slate-900">{metrics.totalReceipts}</div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500 font-medium">Quantidade Total de Itens</div>
                <div className="text-lg font-bold text-slate-900">{metrics.totalItems}</div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500 font-medium">Formatos Disponíveis</div>
                <div className="text-xs font-semibold text-slate-700 mt-1 flex gap-2">
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-200">.xlsx</span>
                  <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded border border-rose-200">.pdf</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[11px] text-slate-500">Impostos Declarados:</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    R$ {metrics.sumTaxes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[11px] text-slate-500">Descontos (Itens):</span>
                  <span className="text-xs font-mono font-semibold text-amber-600">
                    R$ {metrics.sumDiscounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
            <h3 className="text-sm font-bold text-slate-800">Pré-visualização dos Dados</h3>
            <span className="text-xs text-slate-500">{reportRows.length} linhas geradas</span>
          </div>
          
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap">
              <thead className="bg-white sticky top-0 shadow-sm z-10 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3 border-b border-slate-200">Data</th>
                  <th className="p-3 border-b border-slate-200">Nº Nota</th>
                  <th className="p-3 border-b border-slate-200">Fornecedor</th>
                  <th className="p-3 border-b border-slate-200">Produto</th>
                  <th className="p-3 border-b border-slate-200 text-right">Qtd</th>
                  <th className="p-3 border-b border-slate-200 text-right">Valor Un.</th>
                  <th className="p-3 border-b border-slate-200 text-right">Total Item</th>
                  <th className="p-3 border-b border-slate-200 text-right">Total Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 animate-pulse">
                      Carregando dados...
                    </td>
                  </tr>
                ) : reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-500">
                      {selectedReceiptIds.size === 0 
                        ? 'Selecione uma ou mais notas acima para visualizar e exportar os dados consolidados.' 
                        : 'Nenhum item encontrado nas notas selecionadas.'}
                    </td>
                  </tr>
                ) : (
                  reportRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-600">{row.date}</td>
                      <td className="p-3 font-mono text-slate-500">{row.documentNumber}</td>
                      <td className="p-3 font-medium text-slate-900 truncate max-w-[150px]" title={row.issuerName}>
                        {row.issuerName}
                      </td>
                      <td className="p-3 truncate max-w-[200px]" title={row.product}>
                        {row.product}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">{row.quantity}</td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {row.unitPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-teal-700">
                        {row.itemTotal.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-900">
                        {row.receiptTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
