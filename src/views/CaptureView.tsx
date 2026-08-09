import React, { useState } from 'react';
import { 
  Upload, Camera, QrCode, FileCode, Zap, ShieldCheck, 
  FileText, Loader2, AlertCircle, ArrowRight, CheckCircle, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { ReadingMode, ReceiptSource, Receipt } from '../types';
import { CameraCapture } from '../components/CameraCapture';
import { QrCodeReader } from '../components/QrCodeReader';
import { convertPdfToImageBase64s, fileToBase64 } from '../lib/pdfUtils';
import { parseFiscalXml } from '../lib/xmlParser';

interface CaptureViewProps {
  readingMode: ReadingMode;
  setReadingMode: (mode: ReadingMode) => void;
  onExtractionSuccess: (extractedData: Omit<Receipt, 'id' | 'createdAt'>) => void;
  userId: string;
}

export const CaptureView: React.FC<CaptureViewProps> = ({
  readingMode,
  setReadingMode,
  onExtractionSuccess,
  userId
}) => {
  const [activeMethod, setActiveMethod] = useState<ReceiptSource>('upload');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isQrReaderOpen, setIsQrReaderOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Files staging state
  const [stagedFiles, setStagedFiles] = useState<{ name: string; type: string; base64: string }[]>([]);

  // Handle Drag and Drop or File Selection
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    setIsProcessing(true);
    setStatusMessage('Lendo e convertendo arquivos selecionados...');

    try {
      const newStaged: { name: string; type: string; base64: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.name.toLowerCase().endsWith('.xml')) {
          // Direct XML Fiscal Parsing without Gemini cost
          setStatusMessage(`Processando XML fiscal: ${file.name}...`);
          const xmlText = await file.text();
          const parsedXmlReceipt = parseFiscalXml(xmlText, userId);
          setIsProcessing(false);
          onExtractionSuccess(parsedXmlReceipt);
          return;
        }

        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          setStatusMessage(`Renderizando páginas do PDF (${file.name})...`);
          const pdfImages = await convertPdfToImageBase64s(file);
          pdfImages.forEach((imgBase64, idx) => {
            newStaged.push({
              name: `${file.name} (Pág ${idx + 1})`,
              type: 'image/png',
              base64: imgBase64
            });
          });
        } else {
          const b64 = await fileToBase64(file);
          newStaged.push({
            name: file.name,
            type: file.type || 'image/jpeg',
            base64: b64
          });
        }
      }

      setStagedFiles((prev) => [...prev, ...newStaged]);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Erro ao processar arquivos:', err);
      setErrorMessage('Ocorreu um erro ao ler os arquivos. Verifique o formato e tente novamente.');
      setIsProcessing(false);
    }
  };

  // Run Gemini Extraction on staged images or camera captures
  const runAiExtraction = async (imagesToProcess: string[], source: ReceiptSource) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage(
      readingMode === 'intensive'
        ? 'Executando extração IA em Modo Intensivo (consolidação multimodal Gemini)...'
        : 'Analisando documento e extraindo campos com Gemini AI...'
    );

    try {
      const res = await fetch('/api/process-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imagesToProcess,
          readingMode,
          source,
          userId
        })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Não foi possível extrair os dados da nota.');
      }

      setIsProcessing(false);
      onExtractionSuccess({
        ...json.data,
        userId
      });

    } catch (err: any) {
      console.error('Erro ao chamar servidor IA:', err);
      setErrorMessage(
        err.message || 'Erro de comunicação com o servidor de IA. Verifique sua conexão e tente novamente.'
      );
      setIsProcessing(false);
    }
  };

  // QR Code URL submission
  const handleQrCodeUrl = async (qrUrl: string) => {
    setIsQrReaderOpen(false);
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage('Consultando portal SEFAZ para extração dos dados...');

    try {
      const res = await fetch('/api/qr-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrUrl })
      });

      const json = await res.json();

      if (json.fallbackToOcr) {
        setErrorMessage(json.message);
        setIsProcessing(false);
        setIsCameraOpen(true); // Open live camera as fallback!
        return;
      }

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao buscar dados do QR Code.');
      }

      setIsProcessing(false);
      onExtractionSuccess({
        ...json.data,
        userId
      });

    } catch (err: any) {
      console.error('Erro no QR code:', err);
      setErrorMessage('Não foi possível ler o site do QR Code. Alternando para captura de foto.');
      setIsProcessing(false);
    }
  };

  // Handle camera photo array completed
  const handleCameraCaptures = (photos: string[]) => {
    setIsCameraOpen(false);
    if (photos.length > 0) {
      runAiExtraction(photos, 'camera');
    }
  };

  return (
    <div id="capture-view-container" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-teal-50 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              Captura Inteligente Multi-Método
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Escanear Nova Nota Fiscal
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl">
              Selecione o método de entrada desejado. O sistema extrai todos os dados com visão computacional Gemini e realiza validação matemática dos itens.
            </p>
          </div>

          {/* Reading Mode Switch Card */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shrink-0 w-full md:w-auto">
            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>Modo de Leitura</span>
              <span className="text-[10px] text-teal-700 font-mono font-semibold">
                {readingMode === 'normal' ? '1 Chamada' : 'Consolidado Multimodal'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="select-mode-normal"
                onClick={() => setReadingMode('normal')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  readingMode === 'normal'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Normal
              </button>

              <button
                id="select-mode-intensive"
                onClick={() => setReadingMode('intensive')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  readingMode === 'intensive'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Intensivo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Input Method Buttons Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        <button
          id="method-btn-upload"
          onClick={() => setActiveMethod('upload')}
          className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
            activeMethod === 'upload'
              ? 'bg-white border-teal-600 text-slate-900 shadow-sm ring-1 ring-teal-600/30'
              : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700 w-fit border border-teal-100 mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-900">Upload de Arquivo</div>
            <p className="text-[11px] text-slate-500 mt-0.5">JPG, PNG, WEBP ou PDF</p>
          </div>
        </button>

        <button
          id="method-btn-camera"
          onClick={() => setIsCameraOpen(true)}
          className="p-4 rounded-xl border bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all flex flex-col justify-between group"
        >
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 w-fit border border-emerald-100 mb-3 group-hover:scale-105 transition-transform">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-900">Câmera ao Vivo</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Captura com pré-visualização</p>
          </div>
        </button>

        <button
          id="method-btn-qr"
          onClick={() => setIsQrReaderOpen(true)}
          className="p-4 rounded-xl border bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all flex flex-col justify-between group"
        >
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-700 w-fit border border-sky-100 mb-3 group-hover:scale-105 transition-transform">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-900">Leitor de QR Code</div>
            <p className="text-[11px] text-slate-500 mt-0.5">NFC-e & SAT via SEFAZ</p>
          </div>
        </button>

        <button
          id="method-btn-xml"
          onClick={() => setActiveMethod('xml')}
          className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
            activeMethod === 'xml'
              ? 'bg-white border-teal-600 text-slate-900 shadow-sm ring-1 ring-teal-600/30'
              : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 w-fit border border-amber-100 mb-3">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-900">XML Fiscal</div>
            <p className="text-[11px] text-slate-500 mt-0.5">NF-e/NFC-e sem custo IA</p>
          </div>
        </button>

      </div>

      {/* Error Alert Display */}
      {errorMessage && (
        <div id="capture-error-alert" className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs sm:text-sm flex items-start gap-3 animate-fade-in shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-rose-900">Aviso do Processamento</div>
            <p className="mt-0.5 text-rose-700">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 text-xs font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {/* Main Drag & Drop Zone */}
      <div className="bg-white border-2 border-dashed border-slate-200 hover:border-teal-500 transition-colors rounded-2xl p-8 text-center relative overflow-hidden group shadow-xs">
        
        {isProcessing ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin"></div>
              <Sparkles className="w-6 h-6 text-teal-600 absolute inset-0 m-auto" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Processando Inteligência Fiscal</h3>
              <p className="text-xs text-teal-700 animate-pulse mt-1 font-mono font-medium">{statusMessage}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 text-teal-600 flex items-center justify-center mx-auto shadow-xs group-hover:scale-105 transition-transform">
              {activeMethod === 'xml' ? <FileCode className="w-8 h-8 text-amber-600" /> : <Upload className="w-8 h-8" />}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {activeMethod === 'xml'
                  ? 'Arraste seu arquivo XML fiscal (.xml) aqui'
                  : 'Arraste e solte fotos ou PDFs da sua Nota Fiscal'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {activeMethod === 'xml'
                  ? 'Compatível com arquivos XML de NF-e, NFC-e e SAT. Processamento instantâneo direto no cliente.'
                  : 'Suporta múltiplos arquivos (.jpg, .png, .pdf). No Modo Intensivo você pode enviar várias páginas/fotos da mesma nota.'}
              </p>
            </div>

            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-semibold cursor-pointer shadow-xs transition-all">
              <Upload className="w-4 h-4" />
              Selecionar {activeMethod === 'xml' ? 'Arquivo XML' : 'Fotos / PDFs'}
              <input
                type="file"
                multiple={readingMode === 'intensive' || activeMethod !== 'xml'}
                accept={activeMethod === 'xml' ? '.xml' : 'image/*,.pdf'}
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
            </label>
          </div>
        )}

      </div>

      {/* Staged Files List (if any selected for AI run) */}
      {stagedFiles.length > 0 && !isProcessing && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Arquivos Prontos para Análise ({stagedFiles.length}):</span>
            <button
              onClick={() => setStagedFiles([])}
              className="text-slate-500 hover:text-rose-600 text-[11px]"
            >
              Limpar Todos
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stagedFiles.map((file, idx) => (
              <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                {file.base64.startsWith('data:image') ? (
                  <img src={file.base64} alt={file.name} className="w-10 h-10 object-cover rounded border border-slate-200 shrink-0" />
                ) : (
                  <FileText className="w-8 h-8 text-teal-600 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-800 truncate">{file.name}</div>
                  <div className="text-[10px] text-teal-700 font-mono font-semibold">Pronto</div>
                </div>
              </div>
            ))}
          </div>

          <button
            id="run-ai-btn"
            onClick={() => runAiExtraction(stagedFiles.map((f) => f.base64), 'upload')}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Executar Extração IA Gemini ({stagedFiles.length} imagens)
          </button>
        </div>
      )}

      {/* Live Camera Modal */}
      {isCameraOpen && (
        <CameraCapture
          onCaptureComplete={handleCameraCaptures}
          onCancel={() => setIsCameraOpen(false)}
          isIntensiveMode={readingMode === 'intensive'}
        />
      )}

      {/* QR Code Reader Modal */}
      {isQrReaderOpen && (
        <QrCodeReader
          onQrCodeDetected={handleQrCodeUrl}
          onFallbackToPhoto={() => {
            setIsQrReaderOpen(false);
            setIsCameraOpen(true);
          }}
          onCancel={() => setIsQrReaderOpen(false)}
        />
      )}

    </div>
  );
};
