export type BusinessCategory = 'restaurant' | 'shop' | 'pharmacy' | 'departmental_store' | 'clothing';

export interface User { id: string; email?: string }
export interface Session { access_token: string; user: User }

export interface Business {
  id: string;
  owner_name: string;
  phone: string;
  business_name: string;
  category: BusinessCategory;
  address: string;
  currency: string;
  tax_rate: number;
  service_charge_rate: number;
  vat_rate: number;
  delivery_charge: number;
  service_area: string | null;
  tax_zone: string | null;
  receipt_message: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  cost: number;
  stock: number;
  sku: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  subtotal: number;
  tax: number;
  discount: number;
  service_charge: number;
  vat: number;
  delivery_charge: number;
  total: number;
  payment_method: string;
  status: string;
  customer_name: string | null;
  note: string | null;
  service_area: string | null;
  tax_zone: string | null;
  created_by: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  business_id: string;
  product_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface SaleWithItems extends Sale {
  sale_items: SaleItem[];
}

export interface Medicine {
  id: string;
  business_id: string;
  medicine_type: string;
  name: string;
  generic_name: string | null;
  manufacturer: string | null;
  reason: string | null;
  batch_number: string | null;
  boxes: number;
  strips: number;
  pieces: number;
  pieces_per_strip: number;
  strips_per_box: number;
  price: number;
  box_price: number;
  strip_price: number;
  cost: number;
  barcode: string | null;
  expiry_date: string;
  expiry_alert_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Dress {
  id: string;
  business_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  material: string | null;
  gender: string | null;
  season: string | null;
  description: string | null;
  price: number;
  cost: number;
  stock: number;
  low_stock_threshold: number;
  barcode: string | null;
  image_url: string | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type ApiResult<T = any> = { data: T | null; error: Error | null };
type AuthListener = (event: string, session: Session | null) => void;

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/$/, '');
const listeners = new Set<AuthListener>();

function getToken() {
  return localStorage.getItem('counterpos_token');
}

function setAuth(token: string | null, user: User | null) {
  if (token && user) {
    localStorage.setItem('counterpos_token', token);
    localStorage.setItem('counterpos_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('counterpos_token');
    localStorage.removeItem('counterpos_user');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const url = `${API_URL}${path}`;
  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const json = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const details = API_URL === '/api'
      ? 'Frontend VITE_API_URL is missing. Set it to your Render backend URL ending with /api, then redeploy the frontend.'
      : `Request failed: ${res.status} ${res.statusText}`;
    throw new Error(json?.message || json?.error || details);
  }
  return json as T;
}

class QueryBuilder<T = any> implements PromiseLike<ApiResult<T>> {
  private filters: Record<string, string> = {};
  private orderBy?: { column: string; ascending: boolean };
  private max?: number;
  private body: any;
  private singleMode = false;

  constructor(private table: string, private method: 'select' | 'insert' | 'update' | 'delete' = 'select', private selectValue = '*') {}

  select(value = '*') { this.selectValue = value; return this; }
  eq(column: string, value: string | number | boolean | null) { this.filters[column] = String(value); return this; }
  order(column: string, opts?: { ascending?: boolean }) { this.orderBy = { column, ascending: opts?.ascending ?? true }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.singleMode = true; return this; }
  maybeSingle() { this.singleMode = true; return this; }

  insert(body: any) { this.method = 'insert'; this.body = body; return this; }
  update(body: any) { this.method = 'update'; this.body = body; return this; }
  delete() { this.method = 'delete'; return this; }

  async execute(): Promise<ApiResult<T>> {
    try {
      const params = new URLSearchParams();
      Object.entries(this.filters).forEach(([k, v]) => params.set(k, v));
      if (this.orderBy) {
        params.set('order', this.orderBy.column);
        params.set('ascending', String(this.orderBy.ascending));
      }
      if (this.max) params.set('limit', String(this.max));
      if (this.selectValue) params.set('select', this.selectValue);
      if (this.singleMode) params.set('single', 'true');
      const qs = params.toString() ? `?${params.toString()}` : '';
      let data: any;
      if (this.method === 'select') data = await request(`/data/${this.table}${qs}`);
      if (this.method === 'insert') data = await request(`/data/${this.table}${qs}`, { method: 'POST', body: JSON.stringify(this.body) });
      if (this.method === 'update') data = await request(`/data/${this.table}${qs}`, { method: 'PATCH', body: JSON.stringify(this.body) });
      if (this.method === 'delete') data = await request(`/data/${this.table}${qs}`, { method: 'DELETE' });
      return { data: data?.data ?? data ?? null, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Request failed') };
    }
  }

  then<TResult1 = ApiResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ApiResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  auth: {
    async getSession(): Promise<{ data: { session: Session | null } }> {
      const token = getToken();
      if (!token) return { data: { session: null } };
      try {
        const res = await request<{ user: User }>('/auth/me');
        const session = { access_token: token, user: res.user };
        localStorage.setItem('counterpos_user', JSON.stringify(res.user));
        return { data: { session } };
      } catch {
        setAuth(null, null);
        return { data: { session: null } };
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        const res = await request<{ token: string; user: User }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setAuth(res.token, res.user);
        const session = { access_token: res.token, user: res.user };
        listeners.forEach((cb) => cb('SIGNED_IN', session));
        return { data: { session, user: res.user }, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error('Sign in failed') };
      }
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, any> } }) {
      try {
        const res = await request<{ token: string; user: User }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, ...options?.data }),
        });
        setAuth(res.token, res.user);
        const session = { access_token: res.token, user: res.user };
        listeners.forEach((cb) => cb('SIGNED_IN', session));
        return { data: { session, user: res.user }, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error('Sign up failed') };
      }
    },
    onAuthStateChange(cb: AuthListener) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    async signOut() {
      setAuth(null, null);
      listeners.forEach((cb) => cb('SIGNED_OUT', null));
      return { error: null };
    },
  },
  from(table: string) {
    return new QueryBuilder(table);
  },
  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, file: File, _options?: Record<string, unknown>) {
          try {
            const form = new FormData();
            form.append('file', file);
            form.append('path', path);
            await request('/uploads', { method: 'POST', body: form });
            return { data: { path }, error: null };
          } catch (err) {
            return { data: null, error: err instanceof Error ? err : new Error('Upload failed') };
          }
        },
        getPublicUrl(path: string) {
          const root = API_URL.replace(/\/api$/, '');
          return { data: { publicUrl: `${root}/uploads/${path}` } };
        },
      };
    },
  },
};
