import { useState, FormEvent } from 'react';
import { Loader2, AlertCircle, Barcode as BarcodeIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Dress } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Modal, Button } from '../ui/Shared';
import ImageDropzone from '../ui/ImageDropzone';
import { DRESS_CATEGORIES, DRESS_SIZES, GENDERS } from './Dresses';

interface Props {
  open: boolean;
  onClose: () => void;
  dress: Dress | null;
  categories: string[];
  currency: string;
  onSaved: (d: Dress, isNew: boolean) => void;
}

export default function DressForm({ open, onClose, dress, categories, currency, onSaved }: Props) {
  const { business } = useAuth();
  const [form, setForm] = useState({
    name: dress?.name ?? '',
    brand: dress?.brand ?? '',
    category: dress?.category ?? '',
    size: dress?.size ?? '',
    color: dress?.color ?? '',
    material: dress?.material ?? '',
    gender: dress?.gender ?? 'Unisex',
    season: dress?.season ?? '',
    description: dress?.description ?? '',
    price: dress ? String(dress.price) : '',
    cost: dress ? String(dress.cost) : '0',
    stock: dress ? String(dress.stock) : '0',
    low_stock_threshold: dress ? String(dress.low_stock_threshold) : '5',
    barcode: dress?.barcode ?? '',
    image_url: dress?.image_url ?? '',
    website: dress?.website ?? '',
    is_active: dress?.is_active ?? true,
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
      setError('Dress name is required.');
      return;
    }
    if (form.price === '' || Number(form.price) < 0) {
      setError('Please enter a valid price.');
      return;
    }
    let website = form.website.trim();
    if (website && !/^https?:\/\//i.test(website)) {
      website = `https://${website}`;
    }
    setSaving(true);
    try {
      const payload = {
        business_id: business.id,
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,
        size: form.size.trim() || null,
        color: form.color.trim() || null,
        material: form.material.trim() || null,
        gender: form.gender.trim() || null,
        season: form.season.trim() || null,
        description: form.description.trim() || null,
        price: Number(form.price),
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        barcode: form.barcode.trim() || null,
        image_url: form.image_url.trim() || null,
        website: website || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (dress) {
        const { data, error } = await supabase.from('dresses').update(payload).eq('id', dress.id).select().single();
        if (error) throw error;
        onSaved(data as Dress, false);
      } else {
        const { data, error } = await supabase.from('dresses').insert(payload).select().single();
        if (error) throw error;
        onSaved(data as Dress, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dress.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100';
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';

  return (
    <Modal open={open} onClose={onClose} title={dress ? 'Edit dress' : 'Add dress'} size="xl">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Dress name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Floral Summer Dress"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls}>Brand</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => update('brand', e.target.value)}
              placeholder="e.g. Zara, H&M, Local Brand"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              list="dress-categories"
              placeholder="e.g. Dress"
              className={inputCls}
            />
            <datalist id="dress-categories">
              {DRESS_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Gender / Department</label>
            <select value={form.gender} onChange={(e) => update('gender', e.target.value)} className={inputCls}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Season</label>
            <input
              type="text"
              value={form.season}
              onChange={(e) => update('season', e.target.value)}
              placeholder="e.g. Summer, Winter"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Size</label>
            <input
              type="text"
              value={form.size}
              onChange={(e) => update('size', e.target.value)}
              list="dress-sizes"
              placeholder="e.g. M, L, XL"
              className={inputCls}
            />
            <datalist id="dress-sizes">
              {DRESS_SIZES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Color</label>
            <input
              type="text"
              value={form.color}
              onChange={(e) => update('color', e.target.value)}
              placeholder="e.g. Blue, Red, Black"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Material</label>
            <input
              type="text"
              value={form.material}
              onChange={(e) => update('material', e.target.value)}
              placeholder="e.g. Cotton, Denim, Silk"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Optional description / notes"
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Price ({currency}) *</label>
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
          <div>
            <label className={labelCls}>Stock</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => update('stock', e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Low stock alert at</label>
            <input
              type="number"
              value={form.low_stock_threshold}
              onChange={(e) => update('low_stock_threshold', e.target.value)}
              placeholder="5"
              min="0"
              step="1"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ImageDropzone
            value={form.image_url || null}
            onChange={(url) => update('image_url', url ?? '')}
            label="Dress image"
            accent="fuchsia"
          />
          <div>
            <label className={labelCls}>Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="https://yourshop.com/product"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">Link to your shop's website or product page.</p>
          </div>
        </div>

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
            className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-400"
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
            {dress ? 'Save changes' : 'Add dress'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
