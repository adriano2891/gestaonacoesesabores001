import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, Trash2, Plus, Sparkles } from 'lucide-react';

interface CameraCaptureProps {
  onCaptureComplete: (images: string[]) => void;
  onCancel: () => void;
  isIntensiveMode: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCaptureComplete,
  onCancel,
  isIntensiveMode
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const startCamera = async () => {
      setIsInitializing(true);
      setCameraError(null);

      try {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        currentStream = newStream;
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err: any) {
        console.error('Erro ao acessar a câmera:', err);
        setCameraError('Não foi possível acessar a câmera. Verifique se a permissão foi concedida no seu navegador.');
      } finally {
        setIsInitializing(false);
      }
    };

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const takeSnap = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedPhotos((prev) => [...prev, dataUrl]);
    }
  };

  const removePhoto = (index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleFinish = () => {
    if (capturedPhotos.length > 0) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      onCaptureComplete(capturedPhotos);
    }
  };

  return (
    <div id="camera-capture-modal" className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 text-white animate-fade-in">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between z-10">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-teal-300">
            <Camera className="w-5 h-5" />
            Câmera Ao Vivo
          </h2>
          <p className="text-xs text-slate-300">
            {isIntensiveMode 
              ? 'Modo Intensivo: tire várias fotos sequenciais do cupom longo'
              : 'Enquadre a nota fiscal de forma nítida e ilumine bem'}
          </p>
        </div>
        
        <button
          id="close-camera-btn"
          onClick={onCancel}
          className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Viewfinder */}
      <div className="relative flex-1 my-4 flex items-center justify-center overflow-hidden rounded-2xl bg-black border border-slate-800 shadow-2xl">
        {cameraError ? (
          <div className="p-6 text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-rose-900/50 text-rose-300 flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-rose-200 mb-2">{cameraError}</p>
            <button
              onClick={() => setFacingMode((f) => f)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-200 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover max-h-[65vh]"
            />

            {/* Alignment Guide Frame */}
            <div className="absolute inset-6 sm:inset-12 border-2 border-dashed border-teal-400/50 rounded-xl pointer-events-none flex flex-col justify-between p-4">
              <div className="flex justify-between">
                <div className="w-4 h-4 border-t-2 border-l-2 border-teal-400"></div>
                <div className="w-4 h-4 border-t-2 border-r-2 border-teal-400"></div>
              </div>
              <div className="text-center text-[11px] text-teal-200 bg-black/60 px-3 py-1 rounded-full self-center backdrop-blur-sm border border-teal-500/30">
                Alinhe a Nota Fiscal dentro desta área
              </div>
              <div className="flex justify-between">
                <div className="w-4 h-4 border-b-2 border-l-2 border-teal-400"></div>
                <div className="w-4 h-4 border-b-2 border-r-2 border-teal-400"></div>
              </div>
            </div>

            {/* Flip Camera Button */}
            <button
              id="flip-camera-btn"
              onClick={toggleCamera}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 shadow-md backdrop-blur-md transition-colors"
              title="Alternar Câmera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Captured Photos Reel (For Multi-page / Intensive Mode) */}
      {capturedPhotos.length > 0 && (
        <div className="mb-4 bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 overflow-x-auto flex items-center gap-3">
          <div className="text-xs font-medium text-slate-400 pl-1 shrink-0">
            Capturas ({capturedPhotos.length}):
          </div>
          {capturedPhotos.map((photo, index) => (
            <div key={index} className="relative group shrink-0 w-16 h-20 rounded-lg overflow-hidden border border-teal-500/40">
              <img src={photo} alt={`Captura ${index + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-0.5 right-0.5 p-1 bg-rose-600 text-white rounded-full opacity-80 hover:opacity-100 transition-opacity"
                title="Remover foto"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <span className="absolute bottom-0.5 left-0.5 bg-black/70 text-[9px] text-teal-300 px-1 rounded">
                #{index + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Controls Footer */}
      <div className="flex items-center justify-around gap-4 pt-2 border-t border-slate-800/80">
        
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
        >
          Cancelar
        </button>

        {/* Shutter Button */}
        <button
          id="shutter-btn"
          onClick={takeSnap}
          disabled={!!cameraError || isInitializing}
          className="w-16 h-16 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 p-1 flex items-center justify-center shadow-lg shadow-teal-500/30 active:scale-95 transition-all disabled:opacity-50 border-4 border-slate-950"
          title="Tirar Foto"
        >
          <div className="w-12 h-12 rounded-full border-2 border-slate-900 flex items-center justify-center">
            <Camera className="w-6 h-6 fill-slate-950" />
          </div>
        </button>

        {/* Process Captured Button */}
        <button
          id="finish-camera-btn"
          onClick={handleFinish}
          disabled={capturedPhotos.length === 0}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all"
        >
          <Check className="w-4 h-4" />
          Processar ({capturedPhotos.length})
        </button>
      </div>

    </div>
  );
};
