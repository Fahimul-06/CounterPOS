import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const UPLOAD_ROOT = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_ROOT));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

const baseOpts = { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false };
const toJSON = {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
};

function schema(def, opts = {}) {
  const s = new mongoose.Schema(def, { ...baseOpts, ...opts });
  s.set('toJSON', toJSON);
  s.set('toObject', toJSON);
  return s;
}

const User = mongoose.model('User', schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
}));

const Business = mongoose.model('Business', schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: false },
  owner_name: String,
  phone: String,
  business_name: String,
  category: { type: String, enum: ['restaurant', 'shop', 'pharmacy', 'departmental_store', 'clothing'], default: 'shop' },
  address: String,
  currency: { type: String, default: 'BDT' },
  tax_rate: { type: Number, default: 0 },
  service_charge_rate: { type: Number, default: 0 },
  vat_rate: { type: Number, default: 0 },
  delivery_charge: { type: Number, default: 0 },
  service_area: { type: String, default: null },
  tax_zone: { type: String, default: null },
  receipt_message: { type: String, default: null },
  logo_url: { type: String, default: null },
}));

const Product = mongoose.model('Product', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: String,
  description: { type: String, default: null },
  category: { type: String, default: null },
  price: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  sku: { type: String, default: null },
  image_url: { type: String, default: null },
  is_active: { type: Boolean, default: true },
}));

const Medicine = mongoose.model('Medicine', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  medicine_type: String,
  name: String,
  generic_name: { type: String, default: null },
  manufacturer: { type: String, default: null },
  reason: { type: String, default: null },
  batch_number: { type: String, default: null },
  boxes: { type: Number, default: 0 },
  strips: { type: Number, default: 0 },
  pieces: { type: Number, default: 0 },
  pieces_per_strip: { type: Number, default: 0 },
  strips_per_box: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  box_price: { type: Number, default: 0 },
  strip_price: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  barcode: { type: String, default: null },
  expiry_date: String,
  expiry_alert_days: { type: Number, default: 30 },
  is_active: { type: Boolean, default: true },
}));

const Dress = mongoose.model('Dress', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: String,
  brand: { type: String, default: null },
  category: { type: String, default: null },
  size: { type: String, default: null },
  color: { type: String, default: null },
  material: { type: String, default: null },
  gender: { type: String, default: null },
  season: { type: String, default: null },
  description: { type: String, default: null },
  price: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  low_stock_threshold: { type: Number, default: 5 },
  barcode: { type: String, default: null },
  image_url: { type: String, default: null },
  website: { type: String, default: null },
  is_active: { type: Boolean, default: true },
}));


const RestaurantTable = mongoose.model('RestaurantTable', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true },
  capacity: { type: Number, default: 4 },
  section: { type: String, default: null },
  status: { type: String, enum: ['available', 'occupied', 'reserved', 'cleaning'], default: 'available' },
  current_order: { type: String, default: null },
  notes: { type: String, default: null },
}));

const KitchenOrder = mongoose.model('KitchenOrder', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  order_number: { type: String, required: true },
  table_name: { type: String, default: null },
  customer_name: { type: String, default: null },
  items: { type: String, required: true },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'], default: 'pending' },
  note: { type: String, default: null },
}));

const Sale = mongoose.model('Sale', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  service_charge: { type: Number, default: 0 },
  vat: { type: Number, default: 0 },
  delivery_charge: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  payment_method: { type: String, default: 'cash' },
  status: { type: String, default: 'completed' },
  customer_name: { type: String, default: null },
  note: { type: String, default: null },
  service_area: { type: String, default: null },
  tax_zone: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}));

const SaleItem = mongoose.model('SaleItem', schema({
  sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', index: true },
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  name: String,
  unit_price: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  line_total: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } }));

const models = { businesses: Business, products: Product, medicines: Medicine, dresses: Dress, restaurant_tables: RestaurantTable, kitchen_orders: KitchenOrder, sales: Sale, sale_items: SaleItem };

function sign(user) {
  return jwt.sign({ id: String(user._id), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function clean(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  obj.id = String(obj.id || obj._id);
  if (obj.business_id) obj.business_id = String(obj.business_id);
  if (obj.created_by) obj.created_by = String(obj.created_by);
  if (obj.sale_id) obj.sale_id = String(obj.sale_id);
  if (obj.product_id) obj.product_id = String(obj.product_id);
  delete obj._id;
  return obj;
}

function withBusiness(payload, userId) {
  return { ...payload, business_id: userId };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { email, password, owner_name, phone, business_name, category, address } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'Email is already registered.' });
    const user = await User.create({ email, password_hash: await bcrypt.hash(password, 10) });
    await Business.create({ _id: user._id, owner_name, phone, business_name, category, address, currency: 'BDT' });
    res.status(201).json({ token: sign(user), user: { id: String(user._id), email: user.email } });
  } catch (err) { next(err); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ message: 'Invalid email or password.' });
    res.json({ token: sign(user), user: { id: String(user._id), email: user.email } });
  } catch (err) { next(err); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } });
});

app.get('/api/data/:table', auth, async (req, res, next) => {
  try {
    const { table } = req.params;
    const Model = models[table];
    if (!Model) return res.status(404).json({ message: 'Unknown resource.' });
    const q = table === 'businesses' ? { _id: req.user.id } : { business_id: req.user.id };
    for (const [k, v] of Object.entries(req.query)) {
      if (['order', 'ascending', 'limit', 'select', 'single'].includes(k)) continue;
      if (k === 'id') q._id = v;
      else if (k === 'business_id') continue;
      else q[k] = v;
    }
    let query = Model.find(q);
    if (req.query.order) query = query.sort({ [req.query.order]: req.query.ascending === 'true' ? 1 : -1 });
    if (req.query.limit) query = query.limit(Number(req.query.limit));
    const docs = await query;
    let rows = docs.map(clean);
    if (table === 'sales' && String(req.query.select || '').includes('sale_items')) {
      rows = await Promise.all(rows.map(async (sale) => ({ ...sale, sale_items: (await SaleItem.find({ sale_id: sale.id, business_id: req.user.id })).map(clean) })));
    }
    res.json({ data: req.query.single === 'true' ? (rows[0] || null) : rows });
  } catch (err) { next(err); }
});

app.post('/api/data/:table', auth, async (req, res, next) => {
  try {
    const Model = models[req.params.table];
    if (!Model) return res.status(404).json({ message: 'Unknown resource.' });
    const makePayload = (item) => req.params.table === 'businesses' ? item : withBusiness(item, req.user.id);
    const input = Array.isArray(req.body) ? req.body : [req.body];
    const docs = await Model.insertMany(input.map(makePayload), { ordered: true });
    res.status(201).json({ data: Array.isArray(req.body) ? docs.map(clean) : clean(docs[0]) });
  } catch (err) { next(err); }
});

app.patch('/api/data/:table', auth, async (req, res, next) => {
  try {
    const Model = models[req.params.table];
    if (!Model) return res.status(404).json({ message: 'Unknown resource.' });
    const q = req.params.table === 'businesses' ? { _id: req.user.id } : { business_id: req.user.id };
    if (req.query.id) q._id = req.query.id;
    await Model.updateMany(q, req.body, { runValidators: false });
    const docs = await Model.find(q).sort({ updated_at: -1 });
    const rows = docs.map(clean);
    res.json({ data: req.query.single === 'true' ? (rows[0] || null) : rows });
  } catch (err) { next(err); }
});

app.delete('/api/data/:table', auth, async (req, res, next) => {
  try {
    const Model = models[req.params.table];
    if (!Model) return res.status(404).json({ message: 'Unknown resource.' });
    const q = req.params.table === 'businesses' ? { _id: req.user.id } : { business_id: req.user.id };
    if (req.query.id) q._id = req.query.id;
    const result = await Model.deleteMany(q);
    res.json({ data: { deleted: result.deletedCount } });
  } catch (err) { next(err); }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post('/api/uploads', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const requested = String(req.body.path || `${req.user.id}/${Date.now()}-${req.file.originalname}`);
    const safe = requested.replace(/\.\./g, '').replace(/^\/+/, '');
    const target = path.join(UPLOAD_ROOT, safe);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, req.file.buffer);
    res.status(201).json({ path: safe, publicUrl: `/uploads/${safe}` });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const port = Number(process.env.PORT || 5000);
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/counterpos');
app.listen(port, () => console.log(`CounterPOS API running on port ${port}`));
