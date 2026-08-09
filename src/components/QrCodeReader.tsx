import React, { useRef, useState, useEffect } from 'react';
import jsQR from 'jsqr';
import { QrCode, Camera, AlertTriangle, ExternalLink, RefreshCw, Upload, CheckCircle2 } from 'lucide-react';

interface QrCodeReaderProps {
  onQrCodeDetected: (qrUrl: string) => void;
  onFallbackToPhoto: () => void;
  onCancel: () => void;
}

export const QrCodeReader: React.FC<QrCodeReaderProps> = ({
  onQrCodeDetected,
  onFallbackToPhoto,
  onCancel
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualUrlInput, setManualUrlInput] = useState('');

  useEffect(() => {
    let animationFrameId: number;
    let localStream: MediaStream | null = null;

    const startQrScan = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        localStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error('Erro ao acessar a câmera para QR Code:', err);
        setErrorMsg('Não foi possível ligar a câmera para o leitor. Tente selecionar uma imagem com o QR Code ou insira a URL manualmente.');
      }
    };

    const scanFrame = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = canvasRef.current || document.createElement('canvas');
        canvasRef.current = canvas;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            console.log('QR Code detectado:', code.data);
            setDetectedUrl(code.data);
            setIsScanning(false);
            if (localStream) {
              localStream.getTracks().forEach((t) => t.stop());
            }
            onQrCodeDetected(code.data);
            return;
          }
        }
      }

      if (isScanning) {
        animationFrameId = requestAnimationFrame(scanFrame);
      }
    };

    startQrScan();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isScanning]);

  // Handle uploading an image with QR Code
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            setDetectedUrl(code.data);
            onQrCodeDetected(code.data);
          } else {
            setErrorMsg('Não foi possível identificar um QR Code válido na imagem selecionada.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualUrlInput.trim().startsWith('http')) {
      onQrCodeDetected(manualUrlInput.trim());
    } else {
      setErrorMsg('Por favor insira uma URL válida começando com http:// ou https://');
    }
  };

  return (
    <div id="qr-reader-modal" className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 text-slate-900 animate-fade-in max-w-2xl mx-auto my-auto h-fit rounded-2xl border border-slate-200 shadow-2xl bg-white">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Leitor de QR Code Fiscal</h3>
            <p className="text-xs text-slate-500">Escaneie o QR Code impresso no cupom da NFC-e/SAT</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-slate-600 hover:text-slate-900 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold"
        >
          Fechar
        </button>
      </div>

      {/* Video / Scanner Area */}
      <div className="my-4 relative min-h-[260px] bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
        {detectedUrl ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h4 className="font-semibold text-emerald-100 text-sm mb-1">QR Code Identificado!</h4>
            <p className="text-xs text-slate-200 break-all bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-3 max-h-24 overflow-y-auto">
              {detectedUrl}
            </p>
            <p className="text-xs text-teal-400 animate-pulse">Buscando dados no portal SEFAZ...</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-64 object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {/* Target overlay */}
            <div className="absolute w-48 h-48 border-2 border-teal-500 rounded-xl pointer-events-none flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="w-full h-0.5 bg-teal-500/80 animate-pulse"></div>
            </div>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Manual URL Input or Fallback to Photo */}
      <div className="space-y-3">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="url"
            value={manualUrlInput}
            onChange={(e) => setManualUrlInput(e.target.value)}
            placeholder="Ou cole a URL da nota (https://sefaz...)"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Buscar URL
          </button>
        </form>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
          <label className="cursor-pointer text-teal-700 hover:text-teal-800 flex items-center gap-1.5 font-semibold">
            <Upload className="w-3.5 h-3.5" />
            Enviar Imagem do QR Code
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>

          <button
            type="button"
            onClick={onFallbackToPhoto}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1.5 font-medium"
          >
            <Camera className="w-3.5 h-3.5 text-amber-600" />
            Usar Câmera / OCR se o portal falhar
          </button>
        </div>
      </div>

    </div>
  );
};
