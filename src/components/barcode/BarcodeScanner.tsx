import { useEffect, useRef, useState, useCallback } from 'react';
import { ScanLine, X, Camera, AlertCircle, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export default function BarcodeScanner({ open, onClose, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectedRef = useRef<{ code: string; time: number } | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error' | 'unsupported'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
  }, []);

  const detectLoop = useCallback(() => {
    if (!detectorRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      detectorRef.current
        .detect(video)
        .then((codes: any[]) => {
          if (codes && codes.length > 0) {
            const code = codes[0].rawValue;
            const now = Date.now();
            // Debounce: same code within 1.5s is ignored
            if (lastDetectedRef.current && lastDetectedRef.current.code === code && now - lastDetectedRef.current.time < 1500) {
              // skip
            } else {
              lastDetectedRef.current = { code, time: now };
              onDetected(code);
            }
          }
        })
        .catch(() => {
          /* detection errors are transient */
        });
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [onDetected]);

  const start = useCallback(async () => {
    setStatus('starting');
    setErrorMsg(null);
    try {
      // Check support
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        setStatus('unsupported');
        return;
      }
      const formats = await BarcodeDetectorCtor.getSupportedFormats();
      detectorRef.current = new BarcodeDetectorCtor({
        formats: formats && formats.length > 0 ? formats : ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'itf', 'qr_code'],
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('scanning');
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not access camera.';
      setErrorMsg(msg);
      setStatus('error');
    }
  }, [detectLoop]);

  useEffect(() => {
    if (open) {
      start();
    } else {
      stop();
      setStatus('idle');
    }
    return () => {
      stop();
    };
  }, [open, start, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in-fast">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-brand-600" />
            <h3 className="font-bold text-slate-900">Scan barcode</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-square bg-slate-950">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Scan overlay */}
          {status === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-brand-400 shadow-[0_0_12px_2px_rgba(51,112,255,0.6)] animate-scan-line" />
              <div className="absolute inset-6 rounded-xl border-2 border-brand-400/70" />
            </div>
          )}

          {status === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Starting camera…</p>
            </div>
          )}

          {status === 'unsupported' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3">
              <AlertCircle className="h-10 w-10 text-amber-400" />
              <p className="text-white font-semibold">Camera scanning not supported</p>
              <p className="text-sm text-slate-300 max-w-xs">
                Your browser doesn't support barcode scanning. Use Chrome or Edge on desktop/Android, or type the code manually.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3">
              <AlertCircle className="h-10 w-10 text-rose-400" />
              <p className="text-white font-semibold">Camera error</p>
              <p className="text-sm text-slate-300 max-w-xs">{errorMsg ?? 'Could not access the camera.'}</p>
            </div>
          )}
        </div>

        <div className="p-4">
          <p className="text-xs text-slate-500 text-center">
            {status === 'scanning' ? 'Point the camera at a barcode. It will be detected automatically.' : 'Camera access required to scan barcodes.'}
          </p>
          {status === 'error' && (
            <button
              onClick={start}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Camera className="h-4 w-4" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
