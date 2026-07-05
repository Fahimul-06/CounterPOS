import { useCallback, useRef, useState } from 'react';
import { UploadCloud, X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { classNames } from '../../lib/utils';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  accent?: 'fuchsia' | 'rose';
}

export default function ImageDropzone({ value, onChange, label = 'Product image', accent = 'fuchsia' }: Props) {
  const { business } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accentBorder = accent === 'rose' ? 'border-rose-300 bg-rose-50' : 'border-fuchsia-300 bg-fuchsia-50';
  const accentText = accent === 'rose' ? 'text-rose-600' : 'text-fuchsia-600';
  const accentBtn = accent === 'rose' ? 'text-rose-600 hover:text-rose-700' : 'text-fuchsia-600 hover:text-fuchsia-700';

  const upload = useCallback(
    async (file: File) => {
      if (!business) return;
      setError(null);

      if (!ACCEPTED.includes(file.type)) {
        setError('Please use JPG, PNG, WebP, or GIF.');
        return;
      }
      if (file.size > MAX_SIZE) {
        setError('Image must be under 5MB.');
        return;
      }

      setUploading(true);
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `${business.id}/${fileName}`;

        const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (upErr) throw upErr;

        const { data } = supabase.storage.from('product-images').getPublicUrl(path);
        onChange(data.publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [business, onChange],
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    upload(files[0]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const remove = () => {
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {value ? (
        <div className="relative rounded-xl border border-slate-200 overflow-hidden group">
          <img src={value} alt="Preview" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={remove}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow hover:bg-white"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={uploading}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 transition-colors"
            title="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={classNames(
            'relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all',
            dragging ? accentBorder : 'border-slate-200 bg-slate-50 hover:bg-slate-100',
            uploading && 'pointer-events-none',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className={classNames('h-7 w-7 animate-spin', accentText)} />
              <p className="text-sm text-slate-500">Uploading…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className={classNames('h-12 w-12 rounded-full grid place-items-center', dragging ? 'bg-white' : 'bg-slate-100')}>
                <UploadCloud className={classNames('h-6 w-6', accentText)} />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                <span className={accentBtn}>Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-slate-400">JPG, PNG, WebP, GIF — max 5MB</p>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
