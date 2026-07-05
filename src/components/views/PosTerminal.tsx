import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  ShoppingCart,
  CreditCard,
  Banknote,
  Wallet,
  Loader2,
  CheckCircle2,
  PackageX,
  ScanLine,
  Tag,
  Receipt,
  Printer,
  Truck,
  MapPinned,
  Building2,
  ChevronDown,
  ChevronUp,
  Store,
  ChefHat,
  Send,
  Table2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product, Sale, BusinessCategory, Medicine, Dress } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, classNames, CATEGORY_META } from '../../lib/utils';
import { Modal, Button, Spinner } from '../ui/Shared';
import BarcodeScanner from '../barcode/BarcodeScanner';

type ProductTable = 'products' | 'medicines' | 'dresses';

function tableForCategory(category: BusinessCategory | undefined): ProductTable {
  if (category === 'pharmacy') return 'medicines';
  if (category === 'clothing') return 'dresses';
  return 'products';
}

function normalizeProduct(row: any, table: ProductTable): Product {
  if (table === 'medicines') {
    const m = row as Medicine;
    return {
      id: m.id,
      business_id: m.business_id,
      name: m.name,
      description: m.generic_name,
      category: m.medicine_type,
      price: m.price,
      cost: m.cost,
      stock: m.pieces,
      sku: m.barcode,
      image_url: null,
      is_active: m.is_active,
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }
  if (table === 'dresses') {
    const d = row as Dress;
    return {
      id: d.id,
      business_id: d.business_id,
      name: d.name,
      description: d.description,
      category: d.category,
      price: d.price,
      cost: d.cost,
      stock: d.stock,
      sku: d.barcode,
      image_url: d.image_url,
      is_active: d.is_active,
      created_at: d.created_at,
      updated_at: d.updated_at,
    };
  }
  return row as Product;
}

interface CartLine {
  product: Product;
  quantity: number;
}

interface ReceiptLine {
  sale_id: string;
  business_id: string;
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

type PaymentMethod = 'cash' | 'card' | 'other';

const RESTAURANT_TABLES = Array.from({ length: 20 }, (_, i) => String(i + 1));

export default function PosTerminal() {
  const { business } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [bookedTables, setBookedTables] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [serviceCharge, setServiceCharge] = useState<string>('');
  const [vatRate, setVatRate] = useState<string>('');
  const [deliveryCharge, setDeliveryCharge] = useState<string>('');
  const [serviceArea, setServiceArea] = useState<string>('');
  const [taxZone, setTaxZone] = useState<string>('');
  const [showCharges, setShowCharges] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<{ sale: Sale; items: ReceiptLine[] } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFlash, setScanFlash] = useState<string | null>(null);

  const currency = business?.currency ?? 'BDT';
  const taxRate = Number(business?.tax_rate ?? 0);
  const isRestaurant = business?.category === 'restaurant';

  // Pre-fill charge fields from business defaults when they become available
  useEffect(() => {
    if (business) {
      setServiceCharge((v) => (v === '' ? String(business.service_charge_rate ?? 0) : v));
      setVatRate((v) => (v === '' ? String(business.vat_rate ?? 0) : v));
      setDeliveryCharge((v) => (v === '' ? String(business.delivery_charge ?? 0) : v));
      setServiceArea((v) => (v === '' ? (business.service_area ?? '') : v));
      setTaxZone((v) => (v === '' ? (business.tax_zone ?? '') : v));
    }
  }, [business]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!business) return;
      const table = tableForCategory(business.category);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (!mounted) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setProducts((data ?? []).map((row: any) => normalizeProduct(row, table)));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [business]);


  const loadBookedTables = useCallback(async () => {
    if (!business || business.category !== 'restaurant') return;
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    const active = new Set<string>();
    ((data ?? []) as Sale[]).forEach((sale) => {
      const table = String(sale.table_number || '').trim();
      if (table && ['kitchen', 'prepared'].includes(String(sale.status))) active.add(table);
    });
    setBookedTables(active);
  }, [business]);

  useEffect(() => {
    loadBookedTables();
  }, [loadBookedTables]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false) || (p.category?.toLowerCase().includes(q) ?? false);
    });
  }, [products, search, activeCategory]);

  const addToCart = useCallback((product: Product) => {
    setCart((c) => {
      const existing = c.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return c;
        return c.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (product.stock <= 0) return c;
      return [...c, { product, quantity: 1 }];
    });
  }, []);

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart((c) => {
      return c.map((l) => {
        if (l.product.id !== productId) return l;
        const next = l.quantity + delta;
        if (next <= 0) return l;
        if (next > l.product.stock) return l;
        return { ...l, quantity: next };
      }).filter((l) => l.quantity > 0);
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setCart((c) => {
      return c.map((l) => {
        if (l.product.id !== productId) return l;
        const clamped = Math.max(1, Math.min(qty, l.product.stock));
        return { ...l, quantity: clamped };
      });
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setCart((c) => c.filter((l) => l.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscount('');
    setCustomerName('');
    setTableNumber('');
    setNote('');
    setError(null);
  }, []);

  const handleScanned = useCallback((code: string) => {
    const match = products.find((p) => p.sku?.toLowerCase() === code.toLowerCase());
    if (match) {
      addToCart(match);
      setScanFlash(match.name);
      setTimeout(() => setScanFlash(null), 1500);
    } else {
      setError(`No product found for barcode "${code}".`);
      setTimeout(() => setError(null), 3000);
    }
  }, [products, addToCart]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, l) => acc + Number(l.product.price) * l.quantity, 0);
    const discountVal = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
    const afterDiscount = subtotal - discountVal;
    const scRate = Math.max(Number(serviceCharge) || 0, 0);
    const vRate = Math.max(Number(vatRate) || 0, 0);
    const delivery = Math.max(Number(deliveryCharge) || 0, 0);
    const serviceChargeAmount = (afterDiscount * scRate) / 100;
    const vatAmount = (afterDiscount * vRate) / 100;
    const tax = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + serviceChargeAmount + vatAmount + tax + delivery;
    return {
      subtotal,
      discountVal,
      serviceChargeAmount,
      vatAmount,
      delivery,
      tax,
      total,
      scRate,
      vRate,
    };
  }, [cart, discount, serviceCharge, vatRate, deliveryCharge, taxRate]);

  const itemCount = cart.reduce((acc, l) => acc + l.quantity, 0);
  const hasExtraCharges = totals.serviceChargeAmount > 0 || totals.vatAmount > 0 || totals.delivery > 0 || taxRate > 0;

  const saveOrder = async (status: 'completed' | 'kitchen') => {
    if (!business) return;
    if (cart.length === 0) {
      setError('Cart is empty. Add products to start an order.');
      return;
    }
    if (status === 'kitchen' && isRestaurant && !tableNumber.trim()) {
      setError('Table number is required before sending the order to kitchen.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          business_id: business.id,
          subtotal: totals.subtotal,
          tax: totals.tax,
          discount: totals.discountVal,
          service_charge: totals.serviceChargeAmount,
          vat: totals.vatAmount,
          delivery_charge: totals.delivery,
          total: totals.total,
          payment_method: payment,
          status,
          order_type: status === 'kitchen' ? 'dine_in' : null,
          table_number: isRestaurant ? tableNumber.trim() || null : null,
          customer_name: customerName.trim() || null,
          note: note.trim() || null,
          service_area: serviceArea.trim() || null,
          tax_zone: taxZone.trim() || null,
        })
        .select()
        .single();
      if (saleError) throw saleError;
      const sale = saleData as Sale;

      const items = cart.map((l) => ({
        sale_id: sale.id,
        business_id: business.id,
        product_id: l.product.id,
        name: l.product.name,
        unit_price: Number(l.product.price),
        quantity: l.quantity,
        line_total: Number(l.product.price) * l.quantity,
      }));
      const { error: itemsError } = await supabase.from('sale_items').insert(items);
      if (itemsError) throw itemsError;

      const table = tableForCategory(business?.category);
      const stockCol = table === 'medicines' ? 'pieces' : 'stock';
      await Promise.all(
        cart.map((l) =>
          supabase
            .from(table)
            .update({ [stockCol]: Math.max(0, l.product.stock - l.quantity), updated_at: new Date().toISOString() })
            .eq('id', l.product.id),
        ),
      );

      setProducts((prev) => prev.map((p) => {
        const line = cart.find((l) => l.product.id === p.id);
        if (!line) return p;
        return { ...p, stock: Math.max(0, p.stock - line.quantity) };
      }));

      if (status === 'completed') setCompletedSale({ sale, items });
      const sentTable = tableNumber.trim();
      clearCart();
      if (status === 'kitchen') {
        setBookedTables((prev) => new Set(prev).add(sentTable));
        loadBookedTables();
      }
      if (status === 'kitchen') setScanFlash(`Order sent to kitchen${sentTable ? ` · Table ${sentTable}` : ''}`);
      if (status === 'kitchen') setTimeout(() => setScanFlash(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save order.');
    } finally {
      setSubmitting(false);
    }
  };

  const completeSale = async () => {
    await saveOrder('completed');
  };

  const sendToKitchen = async () => {
    await saveOrder('kitchen');
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Spinner label="Loading products…" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
      {/* Product browser */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, or category…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-12 py-2.5 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all"
            />
            <button
              onClick={() => setScannerOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              title="Scan barcode"
            >
              <ScanLine className="h-4 w-4" />
            </button>
          </div>
          {categories.length > 0 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              <CategoryChip label="All" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
              {categories.map((c) => (
                <CategoryChip key={c} label={c} active={activeCategory === c} onClick={() => setActiveCategory(c)} />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mb-4">
                <PackageX className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-base font-semibold text-slate-900">
                {products.length === 0 ? 'No products yet' : 'No products match your search'}
              </p>
              <p className="mt-1 text-sm text-slate-500 max-w-sm">
                {products.length === 0 ? 'Add products in the Products tab to start selling.' : 'Try a different search or category.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map((p) => {
                const out = p.stock <= 0;
                const inCart = cart.find((l) => l.product.id === p.id)?.quantity ?? 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    className={classNames(
                      'group relative flex flex-col rounded-2xl border bg-white p-3 text-left transition-all',
                      out
                        ? 'border-slate-200 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 hover:border-brand-300 hover:shadow-soft-lg hover:-translate-y-0.5 active:translate-y-0',
                    )}
                  >
                    {inCart > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-6 min-w-6 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold grid place-items-center shadow-sm animate-pop">
                        {inCart}
                      </span>
                    )}
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 grid place-items-center mb-2.5 overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Tag className="h-7 w-7 text-slate-400" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight">{p.name}</p>
                    {p.category && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{p.category}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">{formatMoney(Number(p.price), currency)}</span>
                      <span className={classNames(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                        out ? 'bg-rose-100 text-rose-700' : p.stock <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
                      )}>
                        {out ? 'Out' : `${p.stock} left`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <aside className="w-full lg:w-[400px] xl:w-[440px] shrink-0 flex flex-col bg-white">
        <div className="p-4 sm:p-5 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-brand-50 grid place-items-center">
                <ShoppingCart className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Current sale</h2>
                <p className="text-[11px] text-slate-500">{itemCount} {itemCount === 1 ? 'item' : 'items'} in cart</p>
              </div>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs font-semibold text-slate-500 hover:text-rose-600 inline-flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 grid place-items-center mb-4">
                <ScanLine className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-base font-semibold text-slate-900">Cart is empty</p>
              <p className="mt-1 text-sm text-slate-500">Tap a product to add it to the sale.</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map((l) => (
                <div key={l.product.id} className="flex gap-3 rounded-xl border border-slate-200 p-2.5 animate-fade-in-fast">
                  <div className="h-12 w-12 rounded-lg bg-slate-100 grid place-items-center shrink-0 overflow-hidden">
                    {l.product.image_url ? (
                      <img src={l.product.image_url} alt={l.product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Tag className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{l.product.name}</p>
                    <p className="text-xs text-slate-500">{formatMoney(Number(l.product.price), currency)} each</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(l.product.id, -1)} className="h-6 w-6 rounded-md bg-slate-100 hover:bg-slate-200 grid place-items-center text-slate-600">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          value={l.quantity}
                          onChange={(e) => setQty(l.product.id, parseInt(e.target.value, 10) || 1)}
                          className="w-10 text-center text-sm font-semibold text-slate-900 bg-transparent outline-none"
                        />
                        <button
                          onClick={() => updateQty(l.product.id, 1)}
                          disabled={l.quantity >= l.product.stock}
                          className="h-6 w-6 rounded-md bg-slate-100 hover:bg-slate-200 grid place-items-center text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{formatMoney(Number(l.product.price) * l.quantity, currency)}</span>
                        <button onClick={() => removeLine(l.product.id)} className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout */}
        <div className="border-t border-slate-200 p-4 sm:p-5 bg-slate-50/50">
          {error && (
            <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 animate-fade-in-fast">
              {error}
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="Discount"
              min="0"
              step="0.01"
              className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {isRestaurant && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold text-amber-800">Select table *</label>
                {tableNumber && <span className="text-[11px] font-bold text-amber-800">Selected: Table {tableNumber}</span>}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {RESTAURANT_TABLES.map((table) => {
                  const booked = bookedTables.has(table);
                  const selected = tableNumber === table;
                  return (
                    <button
                      key={table}
                      type="button"
                      onClick={() => !booked && setTableNumber(table)}
                      disabled={booked}
                      className={classNames(
                        'min-h-[52px] rounded-xl border-2 px-2 py-1 text-center transition-all',
                        booked
                          ? 'border-amber-300 bg-amber-100 text-amber-800 cursor-not-allowed'
                          : selected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                            : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
                      )}
                    >
                      <Table2 className="h-4 w-4 mx-auto mb-0.5" />
                      <span className="block text-xs font-extrabold">{table}</span>
                      <span className="block text-[9px] font-semibold">{booked ? 'Booked' : selected ? 'Selected' : 'Free'}</span>
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Custom table e.g. VIP-1"
                className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
              <p className="mt-1 text-[11px] text-amber-700">Booked tables are locked until the order is completed from the Tables page.</p>
            </div>
          )}

          {/* Collapsible charges & zones */}
          <button
            onClick={() => setShowCharges((s) => !s)}
            className="mb-3 w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <span className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-slate-400" />
              Charges, VAT & delivery
              {hasExtraCharges && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
            </span>
            {showCharges ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showCharges && (
            <div className="mb-3 space-y-2 animate-fade-in-fast">
              <div className="grid grid-cols-3 gap-2">
                <ChargeInput label="Service %" value={serviceCharge} onChange={setServiceCharge} />
                <ChargeInput label="VAT %" value={vatRate} onChange={setVatRate} />
                <ChargeInput label="Delivery" value={deliveryCharge} onChange={setDeliveryCharge} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput icon={MapPinned} placeholder="Service area" value={serviceArea} onChange={setServiceArea} />
                <LabeledInput icon={Building2} placeholder="Tax zone" value={taxZone} onChange={setTaxZone} />
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Sale note (optional)"
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              />
            </div>
          )}

          <div className="mb-3 grid grid-cols-3 gap-2">
            <PaymentButton current={payment} value="cash" onClick={setPayment} icon={Banknote} label="Cash" />
            <PaymentButton current={payment} value="card" onClick={setPayment} icon={CreditCard} label="Card" />
            <PaymentButton current={payment} value="other" onClick={setPayment} icon={Wallet} label="Other" />
          </div>

          <div className="space-y-1.5 mb-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium text-slate-900">{formatMoney(totals.subtotal, currency)}</span>
            </div>
            {totals.discountVal > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span className="font-medium">-{formatMoney(totals.discountVal, currency)}</span>
              </div>
            )}
            {totals.serviceChargeAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Service charge ({totals.scRate.toFixed(1)}%)</span>
                <span className="font-medium text-slate-900">{formatMoney(totals.serviceChargeAmount, currency)}</span>
              </div>
            )}
            {totals.vatAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>VAT ({totals.vRate.toFixed(1)}%)</span>
                <span className="font-medium text-slate-900">{formatMoney(totals.vatAmount, currency)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax ({taxRate.toFixed(2)}%)</span>
                <span className="font-medium text-slate-900">{formatMoney(totals.tax, currency)}</span>
              </div>
            )}
            {totals.delivery > 0 && (
              <div className="flex justify-between text-slate-600">
                <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Delivery</span>
                <span className="font-medium text-slate-900">{formatMoney(totals.delivery, currency)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900">Total</span>
              <span className="text-xl font-extrabold text-slate-900">{formatMoney(totals.total, currency)}</span>
            </div>
          </div>

          {isRestaurant && (
            <button
              onClick={sendToKitchen}
              disabled={submitting || cart.length === 0}
              className="mb-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-600/10 hover:bg-amber-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send order to kitchen
                </>
              )}
            </button>
          )}

          <button
            onClick={completeSale}
            disabled={submitting || cart.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                {isRestaurant ? <ChefHat className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                {isRestaurant ? `Complete paid order ${formatMoney(totals.total, currency)}` : `Charge ${formatMoney(totals.total, currency)}`}
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Receipt modal */}
      <ReceiptModal
        open={!!completedSale}
        onClose={() => setCompletedSale(null)}
        sale={completedSale?.sale ?? null}
        items={completedSale?.items ?? []}
        business={business}
        currency={currency}
        taxRate={taxRate}
      />

      {/* Barcode scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          handleScanned(code);
        }}
      />

      {/* Scan flash toast */}
      {scanFlash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-fast">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-semibold">Added: {scanFlash}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChargeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-slate-500 mb-1">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        step="0.01"
        placeholder="0"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function LabeledInput({ icon: Icon, placeholder, value, onChange }: { icon: typeof MapPinned; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      )}
    >
      {label}
    </button>
  );
}

function PaymentButton({
  current,
  value,
  onClick,
  icon: Icon,
  label,
}: {
  current: PaymentMethod;
  value: PaymentMethod;
  onClick: (v: PaymentMethod) => void;
  icon: typeof Banknote;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={classNames(
        'flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 transition-all',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

function ReceiptModal({
  open,
  onClose,
  sale,
  items,
  business,
  currency,
  taxRate,
}: {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  items: ReceiptLine[];
  business: { business_name: string; address: string; owner_name: string; category: string; phone?: string; service_area?: string | null; tax_zone?: string | null; receipt_message?: string | null; logo_url?: string | null } | null;
  currency: string;
  taxRate: number;
}) {
  if (!sale || !business) return null;
  const meta = CATEGORY_META[business.category as BusinessCategory];
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="p-5 print-receipt">
        <div className="flex flex-col items-center text-center pb-4 border-b border-dashed border-slate-200">
          <div className={classNames('h-12 w-12 rounded-2xl bg-gradient-to-br grid place-items-center text-white mb-3', meta?.gradient ?? 'from-slate-700 to-slate-900')}>
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-lg font-extrabold text-slate-900">Payment received</p>
          <p className="text-sm text-slate-500">{formatMoney(Number(sale.total), currency)} via {sale.payment_method}</p>
        </div>

        <div className="py-4 text-center">
          {business.logo_url ? (
            <img src={business.logo_url} alt="Logo" className="mx-auto h-16 w-16 object-contain mb-2" />
          ) : (
            <div className={classNames('h-12 w-12 rounded-2xl bg-gradient-to-br grid place-items-center text-white mx-auto mb-2', meta?.gradient ?? 'from-slate-700 to-slate-900')}>
              <Store className="h-6 w-6" />
            </div>
          )}
          <p className="font-bold text-slate-900">{business.business_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{business.address}</p>
          {business.phone && <p className="text-xs text-slate-500 mt-0.5">Tel: {business.phone}</p>}
        </div>

        <div className="border-t border-dashed border-slate-200 pt-3 space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{it.name}</p>
                <p className="text-xs text-slate-500">{it.quantity} × {formatMoney(Number(it.unit_price), currency)}</p>
              </div>
              <span className="font-semibold text-slate-900 shrink-0">{formatMoney(Number(it.line_total), currency)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-slate-200 mt-3 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatMoney(Number(sale.subtotal), currency)}</span>
          </div>
          {Number(sale.discount) > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span>-{formatMoney(Number(sale.discount), currency)}</span>
            </div>
          )}
          {Number(sale.service_charge) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Service charge</span>
              <span>{formatMoney(Number(sale.service_charge), currency)}</span>
            </div>
          )}
          {Number(sale.vat) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>VAT</span>
              <span>{formatMoney(Number(sale.vat), currency)}</span>
            </div>
          )}
          {taxRate > 0 && Number(sale.tax) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Tax ({taxRate.toFixed(2)}%)</span>
              <span>{formatMoney(Number(sale.tax), currency)}</span>
            </div>
          )}
          {Number(sale.delivery_charge) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Delivery charge</span>
              <span>{formatMoney(Number(sale.delivery_charge), currency)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-900">Total</span>
            <span className="font-extrabold text-slate-900">{formatMoney(Number(sale.total), currency)}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 space-y-1 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Payment method</span>
            <span className="font-medium capitalize">{sale.payment_method}</span>
          </div>
          {sale.customer_name && (
            <div className="flex justify-between">
              <span>Customer</span>
              <span className="font-medium">{sale.customer_name}</span>
            </div>
          )}
          {sale.service_area && (
            <div className="flex justify-between">
              <span>Service area</span>
              <span className="font-medium">{sale.service_area}</span>
            </div>
          )}
          {sale.tax_zone && (
            <div className="flex justify-between">
              <span>Tax zone</span>
              <span className="font-medium">{sale.tax_zone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Invoice</span>
            <span className="font-mono">{sale.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        {sale.note && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold">Note: </span>{sale.note}
          </div>
        )}

        <div className="mt-4 text-center text-xs text-slate-400">
          {new Date(sale.created_at).toLocaleString()}
        </div>

        {business.receipt_message && (
          <div className="mt-3 pt-3 border-t border-dashed border-slate-200 text-center">
            <p className="text-xs text-slate-600 italic">{business.receipt_message}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2 no-print">
          <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button className="flex-1" onClick={onClose}>
            New sale
          </Button>
        </div>
      </div>
    </Modal>
  );
}
