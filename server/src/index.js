import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
app.use(express.urlencoded({ extended: true }));
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
  reset_token_hash: { type: String, default: null },
  reset_token_expires_at: { type: Date, default: null },
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
  subscription_plan: { type: String, enum: ['trial', 'monthly', 'yearly'], default: 'trial' },
  subscription_status: { type: String, enum: ['trialing', 'active', 'expired', 'cancelled'], default: 'trialing' },
  trial_starts_at: { type: Date, default: Date.now },
  trial_ends_at: { type: Date, default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
  subscription_ends_at: { type: Date, default: null },
  subscription_last_payment_at: { type: Date, default: null },
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
  expiry_date: { type: String, default: null },
  expiry_alert_days: { type: Number, default: 30 },
  is_active: { type: Boolean, default: true },
}));

const Medicine = mongoose.model('Medicine', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  medicine_type: String,
  name: String,
  brand_name: { type: String, default: null },
  generic_name: { type: String, default: null },
  manufacturer: { type: String, default: null },
  category: { type: String, default: null },
  strength: { type: String, default: null },
  dosage_form: { type: String, default: null },
  pack_size: { type: String, default: null },
  reason: { type: String, default: null },
  batch_number: { type: String, default: null },
  sku: { type: String, default: null },
  rack_location: { type: String, default: null },
  boxes: { type: Number, default: 0 },
  strips: { type: Number, default: 0 },
  pieces: { type: Number, default: 0 },
  pieces_per_strip: { type: Number, default: 10 },
  strips_per_box: { type: Number, default: 10 },
  price: { type: Number, default: 0 },
  box_price: { type: Number, default: 0 },
  strip_price: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  purchase_price: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  selling_price: { type: Number, default: 0 },
  low_stock_threshold: { type: Number, default: 10 },
  barcode: { type: String, default: null },
  image_url: { type: String, default: null },
  expiry_date: String,
  expiry_alert_days: { type: Number, default: 30 },
  is_active: { type: Boolean, default: true },
}));


const MedicineCatalog = mongoose.model('MedicineCatalog', schema({
  code: { type: String, required: true, unique: true, index: true },
  barcode: { type: String, default: null, index: true },
  qr_code: { type: String, default: null, index: true },
  name: { type: String, required: true },
  brand_name: { type: String, default: null },
  generic_name: { type: String, default: null },
  manufacturer: { type: String, default: null },
  category: { type: String, default: null },
  strength: { type: String, default: null },
  dosage_form: { type: String, default: null },
  medicine_type: { type: String, default: 'Tablet' },
  pack_size: { type: String, default: null },
  pieces_per_strip: { type: Number, default: 10 },
  strips_per_box: { type: Number, default: 10 },
  mrp: { type: Number, default: 0 },
  selling_price: { type: Number, default: 0 },
  source: { type: String, default: 'business_entry' },
}));

const MedicineBatch = mongoose.model('MedicineBatch', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', index: true },
  batch_number: { type: String, required: true },
  manufacturing_date: { type: String, default: null },
  expiry_date: { type: String, required: true, index: true },
  quantity: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  purchase_price: { type: Number, default: 0 },
  selling_price: { type: Number, default: 0 },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  status: { type: String, enum: ['active', 'sold_out', 'expired', 'damaged', 'returned'], default: 'active' },
}));

const Supplier = mongoose.model('Supplier', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  address: { type: String, default: null },
  opening_due: { type: Number, default: 0 },
  current_due: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
}));

const Purchase = mongoose.model('Purchase', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  supplier_name: { type: String, default: null },
  invoice_no: { type: String, default: null },
  purchase_date: { type: String, default: null },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  due: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'received', 'cancelled'], default: 'received' },
  note: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}));

const PurchaseItem = mongoose.model('PurchaseItem', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
  medicine_name: { type: String, default: null },
  batch_number: { type: String, default: null },
  expiry_date: { type: String, default: null },
  quantity: { type: Number, default: 0 },
  unit_cost: { type: Number, default: 0 },
  line_total: { type: Number, default: 0 },
}));

const SupplierPayment = mongoose.model('SupplierPayment', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', index: true },
  amount: { type: Number, default: 0 },
  payment_method: { type: String, default: 'cash' },
  payment_date: { type: String, default: null },
  note: { type: String, default: null },
}));

const PurchaseReturn = mongoose.model('PurchaseReturn', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  reason: { type: String, default: null },
  return_date: { type: String, default: null },
}));

const Customer = mongoose.model('Customer', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true },
  phone: { type: String, default: null },
  address: { type: String, default: null },
  current_due: { type: Number, default: 0 },
  notes: { type: String, default: null },
}));

const Prescription = mongoose.model('Prescription', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customer_name: { type: String, default: null },
  doctor_name: { type: String, default: null },
  prescription_date: { type: String, default: null },
  image_url: { type: String, default: null },
  notes: { type: String, default: null },
}));

const CustomerDue = mongoose.model('CustomerDue', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  amount: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  due: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'partial', 'paid'], default: 'open' },
  note: { type: String, default: null },
}));

const SaleReturn = mongoose.model('SaleReturn', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  reason: { type: String, default: null },
  return_date: { type: String, default: null },
}));

const StockMovement = mongoose.model('StockMovement', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', index: true },
  batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicineBatch', default: null },
  movement_type: { type: String, enum: ['purchase', 'sale', 'adjustment', 'damage', 'expiry', 'return_in', 'return_out', 'transfer_in', 'transfer_out'], default: 'adjustment' },
  quantity: { type: Number, default: 0 },
  before_quantity: { type: Number, default: 0 },
  after_quantity: { type: Number, default: 0 },
  reference: { type: String, default: null },
  note: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}));

const StockAdjustment = mongoose.model('StockAdjustment', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', index: true },
  batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicineBatch', default: null },
  adjustment_type: { type: String, enum: ['increase', 'decrease', 'damage', 'expired'], default: 'decrease' },
  quantity: { type: Number, default: 0 },
  reason: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}));

const CashSession = mongoose.model('CashSession', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  cashier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  opened_at: { type: Date, default: Date.now },
  closed_at: { type: Date, default: null },
  opening_cash: { type: Number, default: 0 },
  expected_cash: { type: Number, default: 0 },
  counted_cash: { type: Number, default: 0 },
  difference: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  note: { type: String, default: null },
}));

const Branch = mongoose.model('Branch', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true },
  address: { type: String, default: null },
  phone: { type: String, default: null },
  is_active: { type: Boolean, default: true },
}));

const StockTransfer = mongoose.model('StockTransfer', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  from_branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  to_branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
  batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicineBatch', default: null },
  quantity: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'sent', 'received', 'cancelled'], default: 'pending' },
  note: { type: String, default: null },
}));

const RolePermission = mongoose.model('RolePermission', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  role: { type: String, required: true },
  permissions: { type: [String], default: [] },
  is_active: { type: Boolean, default: true },
}));

const AuditLog = mongoose.model('AuditLog', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actor_email: { type: String, default: null },
  action: { type: String, required: true },
  resource: { type: String, default: null },
  resource_id: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
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
  table_number: { type: String, default: null },
  order_type: { type: String, default: null },
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

const Expense = mongoose.model('Expense', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  title: { type: String, required: true },
  category: { type: String, default: 'General' },
  amount: { type: Number, required: true, default: 0 },
  payment_method: { type: String, default: 'cash' },
  expense_date: { type: Date, default: Date.now },
  note: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}));

const PaymentTransaction = mongoose.model('PaymentTransaction', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  tran_id: { type: String, required: true, unique: true, index: true },
  val_id: { type: String, default: null },
  gateway: { type: String, enum: ['sslcommerz', 'bkash'], default: 'sslcommerz', index: true },
  bkash_payment_id: { type: String, default: null, index: true },
  bkash_transaction_id: { type: String, default: null },
  plan: { type: String, enum: ['monthly', 'yearly'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'BDT' },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled'], default: 'pending' },
  gateway_response: { type: mongoose.Schema.Types.Mixed, default: null },
  paid_at: { type: Date, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}));

const models = {
  businesses: Business,
  products: Product,
  medicines: Medicine,
  medicine_batches: MedicineBatch,
  medicine_catalog: MedicineCatalog,
  suppliers: Supplier,
  purchases: Purchase,
  purchase_items: PurchaseItem,
  supplier_payments: SupplierPayment,
  purchase_returns: PurchaseReturn,
  customers: Customer,
  prescriptions: Prescription,
  customer_dues: CustomerDue,
  sale_returns: SaleReturn,
  stock_movements: StockMovement,
  stock_adjustments: StockAdjustment,
  cash_sessions: CashSession,
  branches: Branch,
  stock_transfers: StockTransfer,
  role_permissions: RolePermission,
  audit_logs: AuditLog,
  dresses: Dress,
  sales: Sale,
  sale_items: SaleItem,
  expenses: Expense,
  payment_transactions: PaymentTransaction,
};

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

function getPlanConfig(plan) {
  const prices = {
    monthly: Number(process.env.SUBSCRIPTION_MONTHLY_PRICE || 999),
    yearly: Number(process.env.SUBSCRIPTION_YEARLY_PRICE || 9999),
  };
  const days = { monthly: 30, yearly: 365 };
  if (!prices[plan]) return null;
  return { amount: prices[plan], days: days[plan] };
}

function businessSubscriptionInfo(business) {
  const now = new Date();
  const trialEnds = business?.trial_ends_at ? new Date(business.trial_ends_at) : null;
  const subscriptionEnds = business?.subscription_ends_at ? new Date(business.subscription_ends_at) : null;
  const paidActive = subscriptionEnds && subscriptionEnds.getTime() > now.getTime();
  const trialActive = !paidActive && trialEnds && trialEnds.getTime() > now.getTime();
  const active = Boolean(paidActive || trialActive);
  const status = paidActive ? 'active' : trialActive ? 'trialing' : 'expired';
  const endsAt = paidActive ? subscriptionEnds : trialEnds;
  const daysRemaining = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;
  return {
    active,
    status,
    plan: paidActive ? business.subscription_plan : 'trial',
    trial_ends_at: trialEnds,
    subscription_ends_at: subscriptionEnds,
    days_remaining: daysRemaining,
  };
}

function apiBaseUrl(req) {
  return (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function clientBaseUrl() {
  return (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '');
}

function sslEndpoint(path) {
  const live = String(process.env.SSLCOMMERZ_IS_LIVE || '').toLowerCase() === 'true';
  const base = live ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com';
  return `${base}${path}`;
}

async function validateSslCommerzPayment(valId) {
  if (!valId) return null;
  const url = new URL(sslEndpoint('/validator/api/validationserverAPI.php'));
  url.searchParams.set('val_id', valId);
  url.searchParams.set('store_id', process.env.SSLCOMMERZ_STORE_ID || '');
  url.searchParams.set('store_passwd', process.env.SSLCOMMERZ_STORE_PASSWORD || '');
  url.searchParams.set('format', 'json');
  const response = await fetch(url);
  return response.json();
}

function bkashEndpoint(path) {
  const explicitBase = process.env.BKASH_BASE_URL;
  const live = String(process.env.BKASH_IS_LIVE || '').toLowerCase() === 'true';
  const base = explicitBase || (live
    ? 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout'
    : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout');
  return `${base.replace(/\/$/, '')}${path}`;
}

function assertBkashConfigured() {
  const required = ['BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USERNAME', 'BKASH_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    const err = new Error(`bKash is not configured. Missing backend env variable(s): ${missing.join(', ')}.`);
    err.status = 400;
    throw err;
  }
}

async function bkashGrantToken() {
  assertBkashConfigured();
  const response = await fetch(bkashEndpoint('/token/grant'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username: process.env.BKASH_USERNAME,
      password: process.env.BKASH_PASSWORD,
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id_token) {
    const err = new Error(data.statusMessage || data.errorMessage || 'bKash token request failed.');
    err.status = response.ok ? 502 : response.status;
    err.gateway = data;
    throw err;
  }
  return data.id_token;
}

async function bkashApi(path, token, payload) {
  const response = await fetch(bkashEndpoint(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: token,
      'X-APP-Key': process.env.BKASH_APP_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.statusMessage || data.errorMessage || 'bKash API request failed.');
    err.status = response.status;
    err.gateway = data;
    throw err;
  }
  return data;
}

function isBkashSuccess(payload) {
  const statusCode = String(payload?.statusCode || '');
  const transactionStatus = String(payload?.transactionStatus || '').toLowerCase();
  return statusCode === '0000' && ['completed', 'success', 'paid'].includes(transactionStatus);
}

async function activateSubscription(transaction, gatewayResponse = {}) {
  if (!transaction || transaction.status === 'paid') return null;
  const config = getPlanConfig(transaction.plan);
  if (!config) throw new Error('Invalid subscription plan.');
  const now = new Date();
  const current = await Business.findById(transaction.business_id);
  const currentEnd = current?.subscription_ends_at && new Date(current.subscription_ends_at) > now
    ? new Date(current.subscription_ends_at)
    : now;
  const newEnd = new Date(currentEnd.getTime() + config.days * 24 * 60 * 60 * 1000);
  await Business.findByIdAndUpdate(transaction.business_id, {
    subscription_plan: transaction.plan,
    subscription_status: 'active',
    subscription_ends_at: newEnd,
    subscription_last_payment_at: now,
  });
  transaction.status = 'paid';
  transaction.paid_at = now;
  transaction.gateway_response = gatewayResponse;
  if (gatewayResponse?.val_id) transaction.val_id = gatewayResponse.val_id;
  if (gatewayResponse?.trxID) transaction.bkash_transaction_id = gatewayResponse.trxID;
  if (gatewayResponse?.transactionId) transaction.bkash_transaction_id = gatewayResponse.transactionId;
  await transaction.save();
  return newEnd;
}

function clean(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  obj.id = String(obj.id || obj._id);
  if (obj.business_id) obj.business_id = String(obj.business_id);
  if (obj.created_by) obj.created_by = String(obj.created_by);
  if (obj.sale_id) obj.sale_id = String(obj.sale_id);
  if (obj.product_id) obj.product_id = String(obj.product_id);
  if (obj.expense_date instanceof Date) obj.expense_date = obj.expense_date.toISOString();
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
    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + 15 * 24 * 60 * 60 * 1000);
    await Business.create({
      _id: user._id,
      owner_name,
      phone,
      business_name,
      category,
      address,
      currency: 'BDT',
      subscription_plan: 'trial',
      subscription_status: 'trialing',
      trial_starts_at: trialStart,
      trial_ends_at: trialEnd,
    });
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

app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    const user = await User.findOne({ email });
    // Always return a neutral message so attackers cannot enumerate accounts.
    if (!user) return res.json({ message: 'If this email exists, a password reset link has been created.' });
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    user.reset_token_hash = await bcrypt.hash(token, 10);
    user.reset_token_expires_at = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const resetLink = `${clientBaseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    console.log(`Password reset link for ${email}: ${resetLink}`);
    const payload = { message: 'If this email exists, a password reset link has been created. Check the backend logs or connect an email provider for production delivery.' };
    if (process.env.NODE_ENV !== 'production') payload.reset_link = resetLink;
    res.json(payload);
  } catch (err) { next(err); }
});

app.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!email || !token || password.length < 6) return res.status(400).json({ message: 'Email, reset token, and a password of at least 6 characters are required.' });
    const user = await User.findOne({ email });
    if (!user || !user.reset_token_hash || !user.reset_token_expires_at || user.reset_token_expires_at.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Reset link is invalid or expired.' });
    }
    const ok = await bcrypt.compare(token, user.reset_token_hash);
    if (!ok) return res.status(400).json({ message: 'Reset link is invalid or expired.' });
    user.password_hash = await bcrypt.hash(password, 10);
    user.reset_token_hash = null;
    user.reset_token_expires_at = null;
    await user.save();
    res.json({ message: 'Password reset successfully.' });
  } catch (err) { next(err); }
});

app.post('/api/auth/change-password', auth, async (req, res, next) => {
  try {
    const current_password = String(req.body.current_password || '');
    const new_password = String(req.body.new_password || '');
    if (new_password.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(current_password, user.password_hash))) return res.status(401).json({ message: 'Current password is incorrect.' });
    user.password_hash = await bcrypt.hash(new_password, 10);
    user.reset_token_hash = null;
    user.reset_token_expires_at = null;
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) { next(err); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } });
});

app.get('/api/subscription', auth, async (req, res, next) => {
  try {
    const business = await Business.findById(req.user.id);
    if (!business) return res.status(404).json({ message: 'Business profile not found.' });
    const transactions = await PaymentTransaction.find({ business_id: req.user.id }).sort({ created_at: -1 }).limit(10);
    res.json({ data: { business: clean(business), subscription: businessSubscriptionInfo(business), transactions: transactions.map(clean) } });
  } catch (err) { next(err); }
});

app.post('/api/subscription/checkout', auth, async (req, res, next) => {
  try {
    const plan = String(req.body.plan || '').toLowerCase();
    const config = getPlanConfig(plan);
    if (!config) return res.status(400).json({ message: 'Select monthly or yearly plan.' });
    if (!process.env.SSLCOMMERZ_STORE_ID || !process.env.SSLCOMMERZ_STORE_PASSWORD) {
      return res.status(400).json({ message: 'SSLCommerz is not configured. Add SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD in backend environment variables.' });
    }
    const business = await Business.findById(req.user.id);
    if (!business) return res.status(404).json({ message: 'Business profile not found.' });
    const tranId = `SUB-${req.user.id}-${Date.now()}`;
    const transaction = await PaymentTransaction.create({
      business_id: req.user.id,
      tran_id: tranId,
      plan,
      amount: config.amount,
      currency: 'BDT',
      gateway: 'sslcommerz',
      status: 'pending',
      created_by: req.user.id,
    });
    const base = apiBaseUrl(req);
    const payload = {
      store_id: process.env.SSLCOMMERZ_STORE_ID,
      store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,
      total_amount: String(config.amount),
      currency: 'BDT',
      tran_id: tranId,
      success_url: `${base}/api/subscription/success`,
      fail_url: `${base}/api/subscription/fail`,
      cancel_url: `${base}/api/subscription/cancel`,
      ipn_url: `${base}/api/subscription/ipn`,
      product_name: `CounterPOS ${plan} subscription`,
      product_category: 'Software Subscription',
      product_profile: 'non-physical-goods',
      cus_name: business.owner_name || business.business_name || 'CounterPOS Customer',
      cus_email: req.user.email,
      cus_add1: business.address || 'Bangladesh',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: business.phone || '01700000000',
      shipping_method: 'NO',
      num_of_item: '1',
      value_a: String(transaction._id),
      value_b: plan,
    };
    const response = await fetch(sslEndpoint('/gwprocess/v4/api.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload),
    });
    const gateway = await response.json();
    transaction.gateway_response = gateway;
    await transaction.save();
    if (!gateway.GatewayPageURL) {
      return res.status(502).json({ message: gateway.failedreason || 'SSLCommerz did not return a checkout URL.', gateway });
    }
    res.json({ data: { checkout_url: gateway.GatewayPageURL, tran_id: tranId } });
  } catch (err) { next(err); }
});

app.post('/api/subscription/bkash/checkout', auth, async (req, res, next) => {
  try {
    const plan = String(req.body.plan || '').toLowerCase();
    const config = getPlanConfig(plan);
    if (!config) return res.status(400).json({ message: 'Select monthly or yearly plan.' });
    assertBkashConfigured();
    const business = await Business.findById(req.user.id);
    if (!business) return res.status(404).json({ message: 'Business profile not found.' });

    const tranId = `BKASH-SUB-${req.user.id}-${Date.now()}`;
    const transaction = await PaymentTransaction.create({
      business_id: req.user.id,
      tran_id: tranId,
      plan,
      amount: config.amount,
      currency: 'BDT',
      gateway: 'bkash',
      status: 'pending',
      created_by: req.user.id,
    });

    const token = await bkashGrantToken();
    const callbackUrl = `${apiBaseUrl(req)}/api/subscription/bkash/callback`;
    const payload = {
      mode: '0011',
      payerReference: business.phone || req.user.email || String(req.user.id),
      callbackURL: callbackUrl,
      amount: String(config.amount),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: tranId,
    };
    const gateway = await bkashApi('/create', token, payload);
    transaction.gateway_response = gateway;
    transaction.bkash_payment_id = gateway.paymentID || gateway.paymentId || null;
    await transaction.save();

    const checkoutUrl = gateway.bkashURL || gateway.bKashURL || gateway.redirectURL || gateway.checkout_url;
    if (!checkoutUrl) {
      return res.status(502).json({ message: gateway.statusMessage || 'bKash did not return a checkout URL.', gateway });
    }
    res.json({ data: { checkout_url: checkoutUrl, tran_id: tranId, payment_id: transaction.bkash_payment_id } });
  } catch (err) { next(err); }
});

async function handleBkashReturn(req, res) {
  const paymentID = req.body.paymentID || req.query.paymentID || req.body.paymentId || req.query.paymentId;
  const callbackStatus = String(req.body.status || req.query.status || '').toLowerCase();
  if (!paymentID) return res.redirect(`${clientBaseUrl()}/?subscription=bkash_missing_payment`);

  const transaction = await PaymentTransaction.findOne({ bkash_payment_id: paymentID, gateway: 'bkash' });
  if (!transaction) return res.redirect(`${clientBaseUrl()}/?subscription=not_found`);

  if (callbackStatus === 'cancel' || callbackStatus === 'cancelled') {
    transaction.status = 'cancelled';
    transaction.gateway_response = { ...transaction.gateway_response, callback: { ...req.query, ...req.body } };
    await transaction.save();
    return res.redirect(`${clientBaseUrl()}/?subscription=cancel`);
  }
  if (callbackStatus === 'failure' || callbackStatus === 'failed') {
    transaction.status = 'failed';
    transaction.gateway_response = { ...transaction.gateway_response, callback: { ...req.query, ...req.body } };
    await transaction.save();
    return res.redirect(`${clientBaseUrl()}/?subscription=fail`);
  }

  const token = await bkashGrantToken();
  const executed = await bkashApi('/execute', token, { paymentID });
  const amountOk = !executed?.amount || Number(executed.amount) === Number(transaction.amount);

  if (isBkashSuccess(executed) && amountOk) {
    await activateSubscription(transaction, { ...executed, callback: { ...req.query, ...req.body } });
    return res.redirect(`${clientBaseUrl()}/?subscription=success`);
  }

  transaction.status = 'failed';
  transaction.gateway_response = { ...transaction.gateway_response, executed, callback: { ...req.query, ...req.body } };
  await transaction.save();
  return res.redirect(`${clientBaseUrl()}/?subscription=validation_failed`);
}

app.get('/api/subscription/bkash/callback', async (req, res, next) => {
  try { await handleBkashReturn(req, res); } catch (err) { next(err); }
});
app.post('/api/subscription/bkash/callback', async (req, res, next) => {
  try { await handleBkashReturn(req, res); } catch (err) { next(err); }
});

async function handlePaymentReturn(req, res, returnStatus) {
  const tranId = req.body.tran_id || req.query.tran_id;
  const valId = req.body.val_id || req.query.val_id;
  const transaction = await PaymentTransaction.findOne({ tran_id: tranId });
  if (!transaction) return res.redirect(`${clientBaseUrl()}/?subscription=not_found`);
  if (returnStatus === 'success') {
    let validation = null;
    try { validation = await validateSslCommerzPayment(valId); } catch (err) { validation = { validation_error: err.message }; }
    const validStatuses = ['VALID', 'VALIDATED'];
    const amountOk = !validation?.amount || Number(validation.amount) === Number(transaction.amount);
    if (validStatuses.includes(String(validation?.status || '').toUpperCase()) && amountOk) {
      await activateSubscription(transaction, { ...req.body, validation });
      return res.redirect(`${clientBaseUrl()}/?subscription=success`);
    }
    transaction.gateway_response = { ...req.body, validation };
    await transaction.save();
    return res.redirect(`${clientBaseUrl()}/?subscription=validation_failed`);
  }
  transaction.status = returnStatus === 'cancel' ? 'cancelled' : 'failed';
  transaction.gateway_response = req.body;
  await transaction.save();
  return res.redirect(`${clientBaseUrl()}/?subscription=${returnStatus}`);
}

app.post('/api/subscription/success', async (req, res, next) => {
  try { await handlePaymentReturn(req, res, 'success'); } catch (err) { next(err); }
});
app.get('/api/subscription/success', async (req, res, next) => {
  try { await handlePaymentReturn(req, res, 'success'); } catch (err) { next(err); }
});
app.post('/api/subscription/fail', async (req, res, next) => {
  try { await handlePaymentReturn(req, res, 'fail'); } catch (err) { next(err); }
});
app.get('/api/subscription/fail', async (req, res, next) => {
  try { await handlePaymentReturn(req, res, 'fail'); } catch (err) { next(err); }
});
app.post('/api/subscription/cancel', async (req, res, next) => {
  try { await handlePaymentReturn(req, res, 'cancel'); } catch (err) { next(err); }
});
app.get('/api/subscription/cancel', async (req, res, next) => {
  try { await handlePaymentReturn(req, res, 'cancel'); } catch (err) { next(err); }
});
app.post('/api/subscription/ipn', async (req, res, next) => {
  try {
    const transaction = await PaymentTransaction.findOne({ tran_id: req.body.tran_id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
    if (String(req.body.status || '').toUpperCase() === 'VALID') {
      const validation = await validateSslCommerzPayment(req.body.val_id);
      const amountOk = !validation?.amount || Number(validation.amount) === Number(transaction.amount);
      if (['VALID', 'VALIDATED'].includes(String(validation?.status || '').toUpperCase()) && amountOk) {
        await activateSubscription(transaction, { ...req.body, validation });
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});


function medicineDisplayPrice(medicine) {
  return Number(medicine.selling_price || medicine.price || medicine.mrp || 0);
}

async function recalcMedicineStock(medicineId, businessId) {
  const batches = await MedicineBatch.find({ medicine_id: medicineId, business_id: businessId, status: { $ne: 'damaged' } });
  const totalPieces = batches.reduce((sum, b) => sum + Math.max(0, Number(b.quantity || 0)), 0);
  await Medicine.findOneAndUpdate({ _id: medicineId, business_id: businessId }, { pieces: totalPieces, updated_at: new Date() });
  return totalPieces;
}


function normalizeScanCode(code) {
  return String(code || '').trim();
}

function getFirstDefined(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function parseMedicinePayloadFromCode(code) {
  const raw = normalizeScanCode(code);
  if (!raw) return null;
  let parsed = null;
  try {
    const maybeJson = raw.startsWith('{') ? raw : raw.includes('{') ? raw.slice(raw.indexOf('{')) : '';
    if (maybeJson) parsed = JSON.parse(maybeJson);
  } catch (_err) {
    parsed = null;
  }
  if (!parsed) {
    try {
      const url = new URL(raw);
      parsed = Object.fromEntries(url.searchParams.entries());
    } catch (_err) {
      parsed = null;
    }
  }
  if (!parsed && raw.includes('|')) {
    const parts = raw.split('|').map((v) => v.trim());
    parsed = { name: parts[0], generic_name: parts[1], strength: parts[2], manufacturer: parts[3], pack_size: parts[4], barcode: parts[5] || raw };
  }
  if (!parsed) return null;
  const medicine = {
    barcode: String(getFirstDefined(parsed, ['barcode', 'bar_code', 'code', 'gtin', 'ean']) || raw),
    qr_code: raw,
    name: getFirstDefined(parsed, ['name', 'product_name', 'medicine_name', 'brand', 'brand_name']),
    brand_name: getFirstDefined(parsed, ['brand_name', 'brand']),
    generic_name: getFirstDefined(parsed, ['generic_name', 'generic', 'genericName']),
    manufacturer: getFirstDefined(parsed, ['manufacturer', 'company', 'manufacturer_company', 'manufacturerName']),
    category: getFirstDefined(parsed, ['category']),
    strength: getFirstDefined(parsed, ['strength', 'dose', 'dosage_strength']),
    dosage_form: getFirstDefined(parsed, ['dosage_form', 'dosageForm', 'form']),
    medicine_type: getFirstDefined(parsed, ['medicine_type', 'type', 'dosage_form', 'form']) || 'Tablet',
    pack_size: getFirstDefined(parsed, ['pack_size', 'packSize', 'package_size', 'pack']),
    pieces_per_strip: Number(getFirstDefined(parsed, ['pieces_per_strip', 'piecesPerStrip', 'unit_per_strip']) || 10),
    strips_per_box: Number(getFirstDefined(parsed, ['strips_per_box', 'stripsPerBox', 'strip_per_box']) || 10),
    mrp: Number(getFirstDefined(parsed, ['mrp', 'maximum_retail_price']) || 0),
    selling_price: Number(getFirstDefined(parsed, ['selling_price', 'price']) || 0),
  };
  if (!medicine.name && medicine.generic_name) medicine.name = medicine.generic_name;
  if (!medicine.name && medicine.manufacturer) medicine.name = `${medicine.manufacturer} medicine`;
  return medicine.name || medicine.generic_name || medicine.manufacturer ? medicine : null;
}

async function upsertMedicineCatalogFromMedicine(medicine) {
  const code = normalizeScanCode(medicine.barcode || medicine.sku);
  if (!code || !medicine.name) return;
  await MedicineCatalog.findOneAndUpdate(
    { code },
    {
      code,
      barcode: medicine.barcode || code,
      name: medicine.name,
      brand_name: medicine.brand_name || null,
      generic_name: medicine.generic_name || null,
      manufacturer: medicine.manufacturer || null,
      category: medicine.category || null,
      strength: medicine.strength || null,
      dosage_form: medicine.dosage_form || null,
      medicine_type: medicine.medicine_type || medicine.dosage_form || 'Tablet',
      pack_size: medicine.pack_size || null,
      pieces_per_strip: Number(medicine.pieces_per_strip || 10),
      strips_per_box: Number(medicine.strips_per_box || 10),
      mrp: Number(medicine.mrp || 0),
      selling_price: Number(medicine.selling_price || medicine.price || 0),
      source: 'business_entry',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

app.get('/api/pharmacy/lookup-code', auth, async (req, res, next) => {
  try {
    const business = await Business.findById(req.user.id);
    if (!business || business.category !== 'pharmacy') return res.status(403).json({ message: 'Medicine barcode lookup is only available for pharmacy accounts.' });
    const code = normalizeScanCode(req.query.code);
    if (!code) return res.status(400).json({ message: 'Barcode or QR code is required.' });

    const existing = await Medicine.findOne({ business_id: req.user.id, $or: [{ barcode: code }, { sku: code }] });
    if (existing) return res.json({ data: { found: true, source: 'business_medicine', medicine: clean(existing) } });

    const catalog = await MedicineCatalog.findOne({ $or: [{ code }, { barcode: code }, { qr_code: code }] });
    if (catalog) return res.json({ data: { found: true, source: 'medicine_catalog', medicine: clean(catalog) } });

    const parsed = parseMedicinePayloadFromCode(code);
    if (parsed) {
      const saved = await MedicineCatalog.findOneAndUpdate(
        { code: parsed.barcode || code },
        { ...parsed, code: parsed.barcode || code },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.json({ data: { found: true, source: 'qr_payload', medicine: clean(saved) } });
    }

    res.json({ data: { found: false, source: null, medicine: null } });
  } catch (err) { next(err); }
});

app.post('/api/pharmacy/checkout', auth, async (req, res, next) => {
  try {
    const business = await Business.findById(req.user.id);
    if (!business || business.category !== 'pharmacy') return res.status(403).json({ message: 'Pharmacy checkout is only available for pharmacy accounts.' });

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: 'Cart is empty.' });

    const paymentMethod = String(req.body.payment_method || 'cash');
    const allowed = ['cash', 'card', 'bkash', 'nagad', 'bangla_qr', 'due', 'other'];
    if (!allowed.includes(paymentMethod)) return res.status(400).json({ message: 'Invalid payment method.' });

    const discount = Math.max(0, Number(req.body.discount || 0));
    const customerName = req.body.customer_name || null;
    const customerId = req.body.customer_id || null;
    const note = req.body.note || null;

    let subtotal = 0;
    const checkoutLines = [];
    for (const raw of items) {
      const medicineId = raw.medicine_id || raw.product_id;
      const quantity = Math.max(1, Number(raw.quantity || 0));
      const medicine = await Medicine.findOne({ _id: medicineId, business_id: req.user.id, is_active: true });
      if (!medicine) return res.status(404).json({ message: `Medicine not found: ${medicineId}` });
      const currentStock = await recalcMedicineStock(medicine._id, req.user.id);
      if (currentStock < quantity) return res.status(400).json({ message: `${medicine.name} has only ${currentStock} piece(s) available.` });
      const unitPrice = Number(raw.unit_price ?? medicineDisplayPrice(medicine));
      subtotal += unitPrice * quantity;
      checkoutLines.push({ medicine, quantity, unitPrice });
    }

    const discountVal = Math.min(discount, subtotal);
    const total = subtotal - discountVal;
    const sale = await Sale.create({
      business_id: req.user.id,
      subtotal,
      discount: discountVal,
      total,
      payment_method: paymentMethod,
      status: 'completed',
      customer_name: customerName,
      note,
      created_by: req.user.id,
    });

    const saleItems = [];
    for (const line of checkoutLines) {
      let remaining = line.quantity;
      const batches = await MedicineBatch.find({
        business_id: req.user.id,
        medicine_id: line.medicine._id,
        quantity: { $gt: 0 },
        status: 'active',
      }).sort({ expiry_date: 1, created_at: 1 });

      for (const batch of batches) {
        if (remaining <= 0) break;
        const used = Math.min(remaining, Number(batch.quantity || 0));
        const before = Number(batch.quantity || 0);
        batch.quantity = before - used;
        if (batch.quantity <= 0) batch.status = 'sold_out';
        await batch.save();
        remaining -= used;
        await StockMovement.create({
          business_id: req.user.id,
          medicine_id: line.medicine._id,
          batch_id: batch._id,
          movement_type: 'sale',
          quantity: -used,
          before_quantity: before,
          after_quantity: batch.quantity,
          reference: String(sale._id),
          note: `FEFO sale from batch ${batch.batch_number}`,
          created_by: req.user.id,
        });
      }
      if (remaining > 0) throw new Error(`Could not allocate enough FEFO stock for ${line.medicine.name}.`);
      await recalcMedicineStock(line.medicine._id, req.user.id);
      saleItems.push(await SaleItem.create({
        sale_id: sale._id,
        business_id: req.user.id,
        product_id: line.medicine._id,
        name: line.medicine.name,
        unit_price: line.unitPrice,
        quantity: line.quantity,
        line_total: line.unitPrice * line.quantity,
      }));
    }

    if (paymentMethod === 'due') {
      let customer = null;
      if (customerId) customer = await Customer.findOne({ _id: customerId, business_id: req.user.id });
      if (!customer && customerName) customer = await Customer.create({ business_id: req.user.id, name: customerName, current_due: 0 });
      if (customer) {
        customer.current_due = Number(customer.current_due || 0) + total;
        await customer.save();
        await CustomerDue.create({ business_id: req.user.id, customer_id: customer._id, sale_id: sale._id, amount: total, due: total, status: 'open' });
      }
    }

    await AuditLog.create({ business_id: req.user.id, actor_id: req.user.id, actor_email: req.user.email, action: 'pharmacy_sale_completed', resource: 'sales', resource_id: String(sale._id), metadata: { payment_method: paymentMethod, total } });
    res.status(201).json({ data: { sale: clean(sale), items: saleItems.map(clean) } });
  } catch (err) { next(err); }
});

app.post('/api/pharmacy/receive-purchase', auth, async (req, res, next) => {
  try {
    const business = await Business.findById(req.user.id);
    if (!business || business.category !== 'pharmacy') return res.status(403).json({ message: 'Only pharmacy accounts can receive medicine purchases.' });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0);
    const discount = Number(req.body.discount || 0);
    const paid = Number(req.body.paid || 0);
    const total = Math.max(0, subtotal - discount);
    const due = Math.max(0, total - paid);
    const purchase = await Purchase.create({
      business_id: req.user.id,
      supplier_id: req.body.supplier_id || null,
      supplier_name: req.body.supplier_name || null,
      invoice_no: req.body.invoice_no || null,
      purchase_date: req.body.purchase_date || new Date().toISOString().slice(0, 10),
      subtotal, discount, total, paid, due,
      status: 'received',
      note: req.body.note || null,
      created_by: req.user.id,
    });
    const purchaseItems = [];
    for (const item of items) {
      const med = await Medicine.findOne({ _id: item.medicine_id, business_id: req.user.id });
      if (!med) continue;
      const qty = Math.max(0, Number(item.quantity || 0));
      const batch = await MedicineBatch.create({
        business_id: req.user.id,
        medicine_id: med._id,
        batch_number: item.batch_number || `B-${Date.now()}`,
        manufacturing_date: item.manufacturing_date || null,
        expiry_date: item.expiry_date,
        quantity: qty,
        cost: Number(item.unit_cost || 0),
        purchase_price: Number(item.unit_cost || 0),
        selling_price: Number(item.selling_price || med.selling_price || med.price || 0),
        supplier_id: req.body.supplier_id || null,
        branch_id: item.branch_id || null,
      });
      purchaseItems.push(await PurchaseItem.create({ business_id: req.user.id, purchase_id: purchase._id, medicine_id: med._id, medicine_name: med.name, batch_number: batch.batch_number, expiry_date: batch.expiry_date, quantity: qty, unit_cost: batch.cost, line_total: qty * batch.cost }));
      await StockMovement.create({ business_id: req.user.id, medicine_id: med._id, batch_id: batch._id, movement_type: 'purchase', quantity: qty, before_quantity: 0, after_quantity: qty, reference: String(purchase._id), note: 'Purchase received', created_by: req.user.id });
      await recalcMedicineStock(med._id, req.user.id);
    }
    if (req.body.supplier_id && due > 0) await Supplier.findOneAndUpdate({ _id: req.body.supplier_id, business_id: req.user.id }, { $inc: { current_due: due } });
    await AuditLog.create({ business_id: req.user.id, actor_id: req.user.id, actor_email: req.user.email, action: 'purchase_received', resource: 'purchases', resource_id: String(purchase._id), metadata: { total, due } });
    res.status(201).json({ data: { purchase: clean(purchase), items: purchaseItems.map(clean) } });
  } catch (err) { next(err); }
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
    if (req.params.table === 'medicines') {
      await Promise.all(docs.map((doc) => upsertMedicineCatalogFromMedicine(doc).catch(() => null)));
    }
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
    if (req.params.table === 'medicines') {
      await Promise.all(docs.map((doc) => upsertMedicineCatalogFromMedicine(doc).catch(() => null)));
    }
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
