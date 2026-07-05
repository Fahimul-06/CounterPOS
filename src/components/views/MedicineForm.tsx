import { useState, FormEvent } from 'react';
import { Loader2, AlertCircle, Barcode as BarcodeIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Medicine } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Modal, Button } from '../ui/Shared';
import ImageDropzone from '../ui/ImageDropzone';
import { MEDICINE_TYPES } from './Medicines';

interface Props {
  open: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  currency: string;
  onSaved: (m: Medicine, isNew: boolean) => void;
}

export default function MedicineForm({ open, onClose, medicine, currency, onSaved }: Props) {
  const { business } = useAuth();
  const [form, setForm] = useState({
    medicine_type: medicine?.medicine_type ?? 'Tablet',
    name: medicine?.name ?? '',
    generic_name: medicine?.generic_name ?? '',
    manufacturer: medicine?.manufacturer ?? '',
    reason: medicine?.reason ?? '',
    batch_number: medicine?.batch_number ?? '',
    boxes: medicine ? String(medicine.boxes) : '0',
    strips: medicine ? String(medicine.strips) : '0',
    pieces: medicine ? String(medicine.pieces) : '0',
    pieces_per_strip: medicine ? String(medicine.pieces_per_strip) : '10',
    strips_per_box: medicine ? String(medicine.strips_per_box) : '10',
    price: medicine ? String(medicine.price) : '',
    box_price: medicine ? String(medicine.box_price) : '0',
    strip_price: medicine ? String(medicine.strip_price) : '0',
    cost: medicine ? String(medicine.cost) : '0',
    barcode: medicine?.barcode ?? '',
    image_url: medicine?.image_url ?? '',
    expiry_date: medicine?.expiry_date ?? '',
    expiry_alert_days: medicine ? String(medicine.expiry_alert_days) : '30',
    is_active: medicine?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const generateBarcode = () => {
    const ts = Date.now().toString().slice(-8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    update('barcode', `${ts}${rand}`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setError(null);
    if (!form.name.trim()) {
      setError('Medicine name is required.');
      return;
    }
    if (!form.medicine_type.trim()) {
      setError('Medicine type is required.');
      return;
    }
    if (!form.expiry_date) {
      setError('Expiry date is required.');
      return;
    }
    if (form.price === '' || Number(form.price) < 0) {
      setError('Please enter a valid selling price.');
      return;
    }
    const alertDays = Number(form.expiry_alert_days);
    if (!Number.isFinite(alertDays) || alertDays < 0) {
      setError('Expiry alert days must be 0 or more.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business_id: business.id,
        medicine_type: form.medicine_type.trim(),
        name: form.name.trim(),
        generic_name: form.generic_name.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        reason: form.reason.trim() || null,
        batch_number: form.batch_number.trim() || null,
        boxes: Number(form.boxes) || 0,
        strips: Number(form.strips) || 0,
        pieces: Number(form.pieces) || 0,
        pieces_per_strip: Number(form.pieces_per_strip) || 0,
        strips_per_box: Number(form.strips_per_box) || 0,
        price: Number(form.price),
        box_price: Number(form.box_price) || 0,
        strip_price: Number(form.strip_price) || 0,
        cost: Number(form.cost) || 0,
        barcode: form.barcode.trim() || null,
        image_url: form.image_url.trim() || null,
        expiry_date: form.expiry_date,
        expiry_alert_days: alertDays,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (medicine) {
        const { data, error } = await supabase
          .from('medicines')
          .update(payload)
          .eq('id', medicine.id)
          .select()
          .single();
        if (error) throw error;
        onSaved(data as Medicine, false);
      } else {
        const { data, error } = await supabase.from('medicines').insert(payload).select().single();
        if (error) throw error;
        onSaved(data as Medicine, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save medicine.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100';
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';

  return (
    <Modal open={open} onClose={onClose} title={medicine ? 'Edit medicine' : 'Add medicine'} size="xl">
      <form onSubmit={submit} className="p-5 space-y-4">
        {/* Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Medicine type *</label>
            <select
              value={form.medicine_type}
              onChange={(e) => update('medicine_type', e.target.value)}
              className={inputCls}
            >
              {MEDICINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Medicine name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Paracetamol 500mg"
              className={inputCls}
              autoFocus
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Generic name</label>
            <input
              type="text"
              value={form.generic_name}
              onChange={(e) => update('generic_name', e.target.value)}
              placeholder="e.g. Acetaminophen"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Manufacturer</label>
            <input
              type="text"
              value={form.manufacturer}
              onChange={(e) => update('manufacturer', e.target.value)}
              placeholder="e.g. Square Pharmaceuticals"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Medicine reason / indication</label>
          <input
            type="text"
            value={form.reason}
            onChange={(e) => update('reason', e.target.value)}
            placeholder="e.g. Fever, headache, pain relief"
            className={inputCls}
          />
        </div>

        {/* Packaging / stock */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Packaging & stock</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Boxes</label>
              <input
                type="number"
                value={form.boxes}
                onChange={(e) => update('boxes', e.target.value)}
                min="0"
                step="1"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Strips</label>
              <input
                type="number"
                value={form.strips}
                onChange={(e) => update('strips', e.target.value)}
                min="0"
                step="1"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Pieces</label>
              <input
                type="number"
                value={form.pieces}
                onChange={(e) => update('pieces', e.target.value)}
                min="0"
                step="1"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Pieces per strip</label>
              <input
                type="number"
                value={form.pieces_per_strip}
                onChange={(e) => update('pieces_per_strip', e.target.value)}
                min="0"
                step="1"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Strips per box</label>
              <input
                type="number"
                value={form.strips_per_box}
                onChange={(e) => update('strips_per_box', e.target.value)}
                min="0"
                step="1"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Batch number</label>
              <input
                type="text"
                value={form.batch_number}
                onChange={(e) => update('batch_number', e.target.value)}
                placeholder="e.g. BN2401"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Piece price ({currency}) *</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Strip price ({currency})</label>
            <input
              type="number"
              value={form.strip_price}
              onChange={(e) => update('strip_price', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Box price ({currency})</label>
            <input
              type="number"
              value={form.box_price}
              onChange={(e) => update('box_price', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Cost ({currency})</label>
            <input
              type="number"
              value={form.cost}
              onChange={(e) => update('cost', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={inputCls}
            />
          </div>
        </div>

        <ImageDropzone
          value={form.image_url || null}
          onChange={(url) => update('image_url', url ?? '')}
          label="Medicine photo"
          accent="rose"
        />

        {/* Expiry + alert */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Expiry date *</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => update('expiry_date', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Expiry alert (days before)</label>
            <input
              type="number"
              value={form.expiry_alert_days}
              onChange={(e) => update('expiry_alert_days', e.target.value)}
              min="0"
              step="1"
              placeholder="30"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Flag as "expiring soon" this many days before the expiry date.
            </p>
          </div>
        </div>

        {/* Barcode */}
        <div>
          <label className={labelCls}>Barcode</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.barcode}
              onChange={(e) => update('barcode', e.target.value)}
              placeholder="Optional — auto-generate or type your own"
              className={`${inputCls} font-mono`}
            />
            <button
              type="button"
              onClick={generateBarcode}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors"
              title="Generate barcode"
            >
              <BarcodeIcon className="h-3.5 w-3.5" />
              Generate
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => update('is_active', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-400"
          />
          <span className="text-sm text-slate-700">Active (available for sale)</span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {medicine ? 'Save changes' : 'Add medicine'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
