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
  sku: { type: String, default: null },
  rack_location: { type: String, default: null },
  purchase_price: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  selling_price: { type: Number, default: 0 },
  low_stock_threshold: { type: Number, default: 20 },
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
  image_url: { type: String, default: null },
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
  customer_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  customer_name: { type: String, default: null },
  customer_phone: { type: String, default: null },
  paid_amount: { type: Number, default: 0 },
  due_amount: { type: Number, default: 0 },
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

const Branch = mongoose.model('Branch', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true },
  code: { type: String, default: null },
  address: { type: String, default: null },
  phone: { type: String, default: null },
  is_active: { type: Boolean, default: true },
}));

const MedicineBatch = mongoose.model('MedicineBatch', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', index: true },
  batch_number: { type: String, required: true },
  manufacturing_date: { type: String, default: null },
  expiry_date: { type: String, required: true, index: true },
  quantity: { type: Number, default: 0 },
  available_quantity: { type: Number, default: 0 },
  unit_cost: { type: Number, default: 0 },
  purchase_price: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'expired', 'damaged', 'returned'], default: 'active' },
  rack_location: { type: String, default: null },
}));

const Supplier = mongoose.model('Supplier', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  address: { type: String, default: null },
  balance_due: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
}));

const Purchase = mongoose.model('Purchase', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  invoice_no: { type: String, default: null },
  purchase_date: { type: Date, default: Date.now },
  total: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  due: { type: Number, default: 0 },
  status: { type: String, enum: ['received', 'partial', 'returned'], default: 'received' },
  note: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}));

const PurchaseItem = mongoose.model('PurchaseItem', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', index: true },
  batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicineBatch', index: true },
  name: String,
  quantity: { type: Number, default: 0 },
  unit_cost: { type: Number, default: 0 },
  line_total: { type: Number, default: 0 },
}));

const SupplierPayment = mongoose.model('SupplierPayment', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  amount: { type: Number, default: 0 },
  payment_method: { type: String, default: 'cash' },
  payment_date: { type: Date, default: Date.now },
  note: { type: String, default: null },
}));

const PurchaseReturn = mongoose.model('PurchaseReturn', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  batch_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  reason: { type: String, default: null },
  return_date: { type: Date, default: Date.now },
}));

const Customer = mongoose.model('Customer', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true },
  phone: { type: String, default: null },
  address: { type: String, default: null },
  due_balance: { type: Number, default: 0 },
  prescription_notes: { type: String, default: null },
  is_active: { type: Boolean, default: true },
}));

const Prescription = mongoose.model('Prescription', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  doctor_name: { type: String, default: null },
  prescription_date: { type: Date, default: Date.now },
  image_url: { type: String, default: null },
  notes: { type: String, default: null },
}));

const CustomerDue = mongoose.model('CustomerDue', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  sale_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  amount: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'partial', 'paid'], default: 'open' },
  due_date: { type: Date, default: null },
}));

const SalesReturn = mongoose.model('SalesReturn', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  sale_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  reason: { type: String, default: null },
  return_date: { type: Date, default: Date.now },
}));

const StockMovement = mongoose.model('StockMovement', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  batch_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  type: { type: String, enum: ['purchase', 'sale', 'adjustment', 'damage', 'expiry', 'return_in', 'return_out', 'transfer_in', 'transfer_out'], default: 'adjustment' },
  quantity_in: { type: Number, default: 0 },
  quantity_out: { type: Number, default: 0 },
  balance_after: { type: Number, default: 0 },
  reference: { type: String, default: null },
  note: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}));

const StockAdjustment = mongoose.model('StockAdjustment', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  batch_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  adjustment_type: { type: String, enum: ['increase', 'decrease', 'damaged', 'expired'], default: 'decrease' },
  quantity: { type: Number, default: 0 },
  reason: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}));

const CashRegister = mongoose.model('CashRegister', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  cashier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  opening_cash: { type: Number, default: 0 },
  closing_cash: { type: Number, default: 0 },
  expected_cash: { type: Number, default: 0 },
  difference: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  opened_at: { type: Date, default: Date.now },
  closed_at: { type: Date, default: null },
  note: { type: String, default: null },
}));

const StockTransfer = mongoose.model('StockTransfer', schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  from_branch_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  to_branch_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  medicine_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  batch_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  quantity: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'sent', 'received', 'cancelled'], default: 'sent' },
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
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resource: { type: String, default: null },
  resource_id: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: null },
  ip_address: { type: String, default: null },
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

const models = { businesses: Business, products: Product, medicines: Medicine, dresses: Dress, sales: Sale, sale_items: SaleItem, expenses: Expense, branches: Branch, medicine_batches: MedicineBatch, suppliers: Supplier, purchases: Purchase, purchase_items: PurchaseItem, supplier_payments: SupplierPayment, purchase_returns: PurchaseReturn, customers: Customer, prescriptions: Prescription, customer_dues: CustomerDue, sales_returns: SalesReturn, stock_movements: StockMovement, stock_adjustments: StockAdjustment, cash_registers: CashRegister, stock_transfers: StockTransfer, role_permissions: RolePermission, audit_logs: AuditLog, payment_transactions: PaymentTransaction };

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
  if (obj.medicine_id) obj.medicine_id = String(obj.medicine_id);
  if (obj.batch_id) obj.batch_id = String(obj.batch_id);
  if (obj.branch_id) obj.branch_id = String(obj.branch_id);
  if (obj.supplier_id) obj.supplier_id = String(obj.supplier_id);
  if (obj.customer_id) obj.customer_id = String(obj.customer_id);
  if (obj.purchase_id) obj.purchase_id = String(obj.purchase_id);
  if (obj.from_branch_id) obj.from_branch_id = String(obj.from_branch_id);
  if (obj.to_branch_id) obj.to_branch_id = String(obj.to_branch_id);
  ['expense_date','purchase_date','payment_date','return_date','due_date','prescription_date','opened_at','closed_at'].forEach((key) => {
    if (obj[key] instanceof Date) obj[key] = obj[key].toISOString();
  });
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
    if (category === 'pharmacy') {
      await seedPharmacyMockData(user._id, user._id, { skipIfExists: true });
    }
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

async function requirePharmacyBusiness(userId) {
  const business = await Business.findById(userId);
  if (!business) {
    const err = new Error('Business profile not found.');
    err.status = 404;
    throw err;
  }
  if (business.category !== 'pharmacy') {
    const err = new Error('This feature is available only for pharmacy accounts.');
    err.status = 403;
    throw err;
  }
  return business;
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function audit({ business_id, user_id, action, resource, resource_id, details, req }) {
  try {
    await AuditLog.create({
      business_id,
      user_id,
      action,
      resource,
      resource_id: resource_id ? String(resource_id) : null,
      details: details || null,
      ip_address: req?.ip || null,
    });
  } catch (err) {
    console.warn('Audit log failed:', err.message);
  }
}

async function syncMedicineStock(medicineId, businessId) {
  const batches = await MedicineBatch.find({ medicine_id: medicineId, business_id: businessId, status: 'active' });
  const pieces = batches.reduce((sum, b) => sum + Number(b.available_quantity || 0), 0);
  await Medicine.findOneAndUpdate({ _id: medicineId, business_id: businessId }, { pieces, updated_at: new Date() });
  return pieces;
}

async function seedPharmacyMockData(businessId, userId, options = {}) {
  const medicineSeeds = [
    { medicine_type: 'Tablet', name: 'Napa 500', brand_name: 'Napa', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', reason: 'Demo: fever and pain category item', category: 'Analgesic', strength: '500mg', dosage_form: 'Tablet', sku: 'BD-MED-NAPA-500', rack_location: 'A1', purchase_price: 0.85, mrp: 1.5, selling_price: 1.5, barcode: 'BDMED000001', batch_number: 'NP2501', pieces_per_strip: 10, strips_per_box: 20, expiry_days: 540, expiry_alert_days: 180, low_stock_threshold: 100 },
    { medicine_type: 'Tablet', name: 'Napa Extend 665', brand_name: 'Napa Extend', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', reason: 'Demo: pain and fever category item', category: 'Analgesic', strength: '665mg', dosage_form: 'Tablet', sku: 'BD-MED-NAPA-EXT-665', rack_location: 'A1', purchase_price: 1.4, mrp: 2.5, selling_price: 2.5, barcode: 'BDMED000002', batch_number: 'NPE2501', pieces_per_strip: 10, strips_per_box: 20, expiry_days: 300, expiry_alert_days: 180, low_stock_threshold: 80 },
    { medicine_type: 'Tablet', name: 'Ace 500', brand_name: 'Ace', generic_name: 'Paracetamol', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: fever and pain category item', category: 'Analgesic', strength: '500mg', dosage_form: 'Tablet', sku: 'BD-MED-ACE-500', rack_location: 'A2', purchase_price: 0.8, mrp: 1.5, selling_price: 1.5, barcode: 'BDMED000003', batch_number: 'AC2501', pieces_per_strip: 10, strips_per_box: 20, expiry_days: 180, expiry_alert_days: 90, low_stock_threshold: 100 },
    { medicine_type: 'Syrup', name: 'Napa Syrup', brand_name: 'Napa', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', reason: 'Demo: pediatric fever category item', category: 'Analgesic', strength: '120mg/5ml', dosage_form: 'Syrup', sku: 'BD-MED-NAPA-SYP', rack_location: 'A3', purchase_price: 24, mrp: 35, selling_price: 35, barcode: 'BDMED000004', batch_number: 'NPS2501', pieces_per_strip: 1, strips_per_box: 1, expiry_days: 90, expiry_alert_days: 90, low_stock_threshold: 15 },
    { medicine_type: 'Capsule', name: 'Seclo 20', brand_name: 'Seclo', generic_name: 'Omeprazole', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: antiulcer/PPI category item', category: 'Gastrointestinal', strength: '20mg', dosage_form: 'Capsule', sku: 'BD-MED-SECLO-20', rack_location: 'B1', purchase_price: 4.2, mrp: 6.0, selling_price: 6.0, barcode: 'BDMED000005', batch_number: 'SC2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 85, expiry_alert_days: 90, low_stock_threshold: 60 },
    { medicine_type: 'Capsule', name: 'Sergel 20', brand_name: 'Sergel', generic_name: 'Esomeprazole', manufacturer: 'Healthcare Pharmaceuticals Ltd.', reason: 'Demo: antiulcer/PPI category item', category: 'Gastrointestinal', strength: '20mg', dosage_form: 'Capsule', sku: 'BD-MED-SERGEL-20', rack_location: 'B1', purchase_price: 5.5, mrp: 8.0, selling_price: 8.0, barcode: 'BDMED000006', batch_number: 'SG2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 420, expiry_alert_days: 180, low_stock_threshold: 60 },
    { medicine_type: 'Tablet', name: 'Maxpro 20', brand_name: 'Maxpro', generic_name: 'Esomeprazole', manufacturer: 'Renata PLC', reason: 'Demo: antiulcer/PPI category item', category: 'Gastrointestinal', strength: '20mg', dosage_form: 'Tablet', sku: 'BD-MED-MAXPRO-20', rack_location: 'B2', purchase_price: 5.5, mrp: 8.0, selling_price: 8.0, barcode: 'BDMED000007', batch_number: 'MX2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 25, expiry_alert_days: 30, low_stock_threshold: 60 },
    { medicine_type: 'Tablet', name: 'DP 10', brand_name: 'DP', generic_name: 'Domperidone', manufacturer: 'Opsonin Pharma Ltd.', reason: 'Demo: antiemetic/gastro category item', category: 'Gastrointestinal', strength: '10mg', dosage_form: 'Tablet', sku: 'BD-MED-DP-10', rack_location: 'B3', purchase_price: 1.4, mrp: 2.0, selling_price: 2.0, barcode: 'BDMED000008', batch_number: 'DP2501', pieces_per_strip: 10, strips_per_box: 20, expiry_days: 150, expiry_alert_days: 180, low_stock_threshold: 80 },
    { medicine_type: 'Syrup', name: 'DP Plus Syrup', brand_name: 'DP Plus', generic_name: 'Domperidone', manufacturer: 'Incepta Pharmaceuticals Ltd.', reason: 'Demo: antiemetic/gastro category item', category: 'Gastrointestinal', strength: '5mg/5ml', dosage_form: 'Syrup', sku: 'BD-MED-DP-PLUS-SYP', rack_location: 'B4', purchase_price: 55, mrp: 75, selling_price: 75, barcode: 'BDMED000009', batch_number: 'DPP2501', pieces_per_strip: 1, strips_per_box: 1, expiry_days: -12, expiry_alert_days: 30, low_stock_threshold: 10 },
    { medicine_type: 'Tablet', name: 'Monas 10', brand_name: 'Monas', generic_name: 'Montelukast', manufacturer: 'The ACME Laboratories Ltd.', reason: 'Demo: allergy/asthma category item', category: 'Respiratory', strength: '10mg', dosage_form: 'Tablet', sku: 'BD-MED-MONAS-10', rack_location: 'C1', purchase_price: 10.5, mrp: 16, selling_price: 16, barcode: 'BDMED000010', batch_number: 'MN2501', pieces_per_strip: 10, strips_per_box: 12, expiry_days: 45, expiry_alert_days: 90, low_stock_threshold: 40 },
    { medicine_type: 'Tablet', name: 'Fexo 120', brand_name: 'Fexo', generic_name: 'Fexofenadine', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: antihistamine/allergy category item', category: 'Antihistamine', strength: '120mg', dosage_form: 'Tablet', sku: 'BD-MED-FEXO-120', rack_location: 'C2', purchase_price: 6.0, mrp: 9.0, selling_price: 9.0, barcode: 'BDMED000011', batch_number: 'FX2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 365, expiry_alert_days: 180, low_stock_threshold: 50 },
    { medicine_type: 'Tablet', name: 'Histacin 4', brand_name: 'Histacin', generic_name: 'Chlorpheniramine Maleate', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: antihistamine/allergy category item', category: 'Antihistamine', strength: '4mg', dosage_form: 'Tablet', sku: 'BD-MED-HISTACIN-4', rack_location: 'C2', purchase_price: 0.35, mrp: 0.7, selling_price: 0.7, barcode: 'BDMED000012', batch_number: 'HS2501', pieces_per_strip: 10, strips_per_box: 20, expiry_days: 210, expiry_alert_days: 180, low_stock_threshold: 120 },
    { medicine_type: 'Tablet', name: 'Zimax 500', brand_name: 'Zimax', generic_name: 'Azithromycin', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: antibiotic category item', category: 'Antibiotic', strength: '500mg', dosage_form: 'Tablet', sku: 'BD-MED-ZIMAX-500', rack_location: 'D1', purchase_price: 26, mrp: 35, selling_price: 35, barcode: 'BDMED000013', batch_number: 'ZX2501', pieces_per_strip: 3, strips_per_box: 20, expiry_days: 120, expiry_alert_days: 180, low_stock_threshold: 30 },
    { medicine_type: 'Capsule', name: 'Moxacil 500', brand_name: 'Moxacil', generic_name: 'Amoxicillin', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: antibiotic category item', category: 'Antibiotic', strength: '500mg', dosage_form: 'Capsule', sku: 'BD-MED-MOXACIL-500', rack_location: 'D1', purchase_price: 4.8, mrp: 7.0, selling_price: 7.0, barcode: 'BDMED000014', batch_number: 'MXC2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 540, expiry_alert_days: 180, low_stock_threshold: 40 },
    { medicine_type: 'Tablet', name: 'Ciprocin 500', brand_name: 'Ciprocin', generic_name: 'Ciprofloxacin', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: antibiotic category item', category: 'Antibiotic', strength: '500mg', dosage_form: 'Tablet', sku: 'BD-MED-CIPROCIN-500', rack_location: 'D2', purchase_price: 8.5, mrp: 12, selling_price: 12, barcode: 'BDMED000015', batch_number: 'CP2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 270, expiry_alert_days: 180, low_stock_threshold: 40 },
    { medicine_type: 'Capsule', name: 'Cef-3 200', brand_name: 'Cef-3', generic_name: 'Cefixime', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: antibiotic category item', category: 'Antibiotic', strength: '200mg', dosage_form: 'Capsule', sku: 'BD-MED-CEF3-200', rack_location: 'D3', purchase_price: 23, mrp: 32, selling_price: 32, barcode: 'BDMED000016', batch_number: 'CF2501', pieces_per_strip: 6, strips_per_box: 10, expiry_days: 90, expiry_alert_days: 90, low_stock_threshold: 24 },
    { medicine_type: 'Tablet', name: 'Amdocal 5', brand_name: 'Amdocal', generic_name: 'Amlodipine', manufacturer: 'Beximco Pharmaceuticals Ltd.', reason: 'Demo: antihypertensive category item', category: 'Cardiac', strength: '5mg', dosage_form: 'Tablet', sku: 'BD-MED-AMDOCAL-5', rack_location: 'E1', purchase_price: 2.8, mrp: 5, selling_price: 5, barcode: 'BDMED000017', batch_number: 'AD2501', pieces_per_strip: 10, strips_per_box: 20, expiry_days: 365, expiry_alert_days: 180, low_stock_threshold: 70 },
    { medicine_type: 'Tablet', name: 'DP-R 5', brand_name: 'DP-R', generic_name: 'Rosuvastatin', manufacturer: 'Drug International Ltd.', reason: 'Demo: lipid-lowering category item', category: 'Cardiac', strength: '5mg', dosage_form: 'Tablet', sku: 'BD-MED-DPR-5', rack_location: 'E1', purchase_price: 7, mrp: 10, selling_price: 10, barcode: 'BDMED000018', batch_number: 'DPR2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 180, expiry_alert_days: 180, low_stock_threshold: 50 },
    { medicine_type: 'Tablet', name: 'Losardil 50', brand_name: 'Losardil', generic_name: 'Losartan Potassium', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: antihypertensive category item', category: 'Cardiac', strength: '50mg', dosage_form: 'Tablet', sku: 'BD-MED-LOSARDIL-50', rack_location: 'E2', purchase_price: 5, mrp: 8, selling_price: 8, barcode: 'BDMED000019', batch_number: 'LS2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 300, expiry_alert_days: 180, low_stock_threshold: 50 },
    { medicine_type: 'Tablet', name: 'Comet 500', brand_name: 'Comet', generic_name: 'Metformin Hydrochloride', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: anti-diabetic category item', category: 'Diabetes', strength: '500mg', dosage_form: 'Tablet', sku: 'BD-MED-COMET-500', rack_location: 'F1', purchase_price: 2, mrp: 3.5, selling_price: 3.5, barcode: 'BDMED000020', batch_number: 'CM2501', pieces_per_strip: 10, strips_per_box: 20, expiry_days: 420, expiry_alert_days: 180, low_stock_threshold: 80 },
    { medicine_type: 'Tablet', name: 'DPZ 10', brand_name: 'DPZ', generic_name: 'Dapagliflozin', manufacturer: 'Popular Pharmaceuticals PLC', reason: 'Demo: anti-diabetic category item', category: 'Diabetes', strength: '10mg', dosage_form: 'Tablet', sku: 'BD-MED-DPZ-10', rack_location: 'F1', purchase_price: 10, mrp: 15, selling_price: 15, barcode: 'BDMED000021', batch_number: 'DPZ2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 75, expiry_alert_days: 90, low_stock_threshold: 40 },
    { medicine_type: 'Tablet', name: 'Ceevit', brand_name: 'Ceevit', generic_name: 'Vitamin C', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: vitamin/supplement category item', category: 'Vitamin & Supplement', strength: '250mg', dosage_form: 'Tablet', sku: 'BD-MED-CEEVIT', rack_location: 'G1', purchase_price: 1.2, mrp: 2, selling_price: 2, barcode: 'BDMED000022', batch_number: 'CV2501', pieces_per_strip: 10, strips_per_box: 20, expiry_days: 180, expiry_alert_days: 180, low_stock_threshold: 100 },
    { medicine_type: 'Tablet', name: 'Calbo-D', brand_name: 'Calbo-D', generic_name: 'Calcium + Vitamin D3', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: calcium/vitamin category item', category: 'Vitamin & Supplement', strength: '500mg + 200IU', dosage_form: 'Tablet', sku: 'BD-MED-CALBO-D', rack_location: 'G2', purchase_price: 6, mrp: 9, selling_price: 9, barcode: 'BDMED000023', batch_number: 'CBD2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 600, expiry_alert_days: 180, low_stock_threshold: 50 },
    { medicine_type: 'Sachet', name: 'Orsaline-N', brand_name: 'Orsaline-N', generic_name: 'Oral Rehydration Salts', manufacturer: 'SMC Enterprise Ltd.', reason: 'Demo: oral rehydration category item', category: 'ORS & Electrolyte', strength: 'ORS sachet', dosage_form: 'Sachet', sku: 'BD-MED-ORSALINE-N', rack_location: 'H1', purchase_price: 4, mrp: 6, selling_price: 6, barcode: 'BDMED000024', batch_number: 'ORS2501', pieces_per_strip: 1, strips_per_box: 50, expiry_days: 365, expiry_alert_days: 180, low_stock_threshold: 100 },
    { medicine_type: 'Cream', name: 'Pevisone Cream', brand_name: 'Pevisone', generic_name: 'Econazole + Triamcinolone', manufacturer: 'Healthcare Pharmaceuticals Ltd.', reason: 'Demo: dermatology category item', category: 'Dermatology', strength: '10g', dosage_form: 'Cream', sku: 'BD-MED-PEVISONE-CRM', rack_location: 'I1', purchase_price: 65, mrp: 90, selling_price: 90, barcode: 'BDMED000025', batch_number: 'PV2501', pieces_per_strip: 1, strips_per_box: 1, expiry_days: 240, expiry_alert_days: 180, low_stock_threshold: 20 },
    { medicine_type: 'Drops', name: 'Napa Drops', brand_name: 'Napa', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.', reason: 'Demo: pediatric drops category item', category: 'Pediatric', strength: '80mg/ml', dosage_form: 'Drops', sku: 'BD-MED-NAPA-DROPS', rack_location: 'A3', purchase_price: 15, mrp: 22, selling_price: 22, barcode: 'BDMED000026', batch_number: 'NPD2501', pieces_per_strip: 1, strips_per_box: 1, expiry_days: 30, expiry_alert_days: 30, low_stock_threshold: 15 },
    { medicine_type: 'Suspension', name: 'Moxacil DS', brand_name: 'Moxacil', generic_name: 'Amoxicillin', manufacturer: 'Square Pharmaceuticals PLC', reason: 'Demo: pediatric antibiotic category item', category: 'Antibiotic', strength: '250mg/5ml', dosage_form: 'Suspension', sku: 'BD-MED-MOXACIL-DS', rack_location: 'D4', purchase_price: 48, mrp: 70, selling_price: 70, barcode: 'BDMED000027', batch_number: 'MXDS2501', pieces_per_strip: 1, strips_per_box: 1, expiry_days: 60, expiry_alert_days: 90, low_stock_threshold: 12 },
    { medicine_type: 'Inhaler', name: 'DP-Haler 100', brand_name: 'DP-Haler', generic_name: 'Salbutamol', manufacturer: 'Aristopharma Ltd.', reason: 'Demo: respiratory inhaler category item', category: 'Respiratory', strength: '100mcg/puff', dosage_form: 'Inhaler', sku: 'BD-MED-DPHALER-100', rack_location: 'C4', purchase_price: 145, mrp: 190, selling_price: 190, barcode: 'BDMED000028', batch_number: 'DPH2501', pieces_per_strip: 1, strips_per_box: 1, expiry_days: 150, expiry_alert_days: 180, low_stock_threshold: 8 },
    { medicine_type: 'Injection', name: 'Ceftriaxone 1g Inj', brand_name: 'DP-Cef', generic_name: 'Ceftriaxone', manufacturer: 'Incepta Pharmaceuticals Ltd.', reason: 'Demo: injectable antibiotic category item', category: 'Antibiotic', strength: '1g/vial', dosage_form: 'Injection', sku: 'BD-MED-CEFTRIAXONE-1G', rack_location: 'J1', purchase_price: 70, mrp: 110, selling_price: 110, barcode: 'BDMED000029', batch_number: 'CTX2501', pieces_per_strip: 1, strips_per_box: 10, expiry_days: 300, expiry_alert_days: 180, low_stock_threshold: 10 },
    { medicine_type: 'Tablet', name: 'Gastrum 20', brand_name: 'Gastrum', generic_name: 'Rabeprazole', manufacturer: 'Ibn Sina Pharmaceutical Industry PLC', reason: 'Demo: antiulcer/PPI category item', category: 'Gastrointestinal', strength: '20mg', dosage_form: 'Tablet', sku: 'BD-MED-GASTRUM-20', rack_location: 'B5', purchase_price: 4.5, mrp: 7, selling_price: 7, barcode: 'BDMED000030', batch_number: 'GS2501', pieces_per_strip: 10, strips_per_box: 10, expiry_days: 720, expiry_alert_days: 180, low_stock_threshold: 50 },
  ];

  const existing = await Medicine.countDocuments({ business_id: businessId });
  if (existing > 0 && options.reset) {
    await Promise.all([
      Medicine.deleteMany({ business_id: businessId }), MedicineBatch.deleteMany({ business_id: businessId }), Supplier.deleteMany({ business_id: businessId }),
      Purchase.deleteMany({ business_id: businessId }), PurchaseItem.deleteMany({ business_id: businessId }), Customer.deleteMany({ business_id: businessId }),
      CustomerDue.deleteMany({ business_id: businessId }), Prescription.deleteMany({ business_id: businessId }), StockMovement.deleteMany({ business_id: businessId }),
      StockAdjustment.deleteMany({ business_id: businessId }), Branch.deleteMany({ business_id: businessId }), CashRegister.deleteMany({ business_id: businessId }),
      StockTransfer.deleteMany({ business_id: businessId }), RolePermission.deleteMany({ business_id: businessId }), AuditLog.deleteMany({ business_id: businessId }),
      Expense.deleteMany({ business_id: businessId }), Sale.deleteMany({ business_id: businessId }), SaleItem.deleteMany({ business_id: businessId }),
    ]);
  }

  const [mainBranch, secondBranch] = await Promise.all([
    Branch.findOneAndUpdate(
      { business_id: businessId, code: 'MAIN' },
      { $setOnInsert: { business_id: businessId, name: 'Main Branch', code: 'MAIN', address: 'Dhanmondi, Dhaka', phone: '01700000001', is_active: true } },
      { upsert: true, new: true }
    ),
    Branch.findOneAndUpdate(
      { business_id: businessId, code: 'MIR' },
      { $setOnInsert: { business_id: businessId, name: 'Mirpur Branch', code: 'MIR', address: 'Mirpur, Dhaka', phone: '01700000002', is_active: true } },
      { upsert: true, new: true }
    ),
  ]);

  const supplierSeeds = [
    { name: 'Square Pharma Depot', phone: '01711111111', address: 'Tejgaon, Dhaka', balance_due: 8500 },
    { name: 'Beximco Distribution', phone: '01822222222', address: 'Motijheel, Dhaka', balance_due: 5200 },
    { name: 'Incepta Wholesale', phone: '01933333333', address: 'Uttara, Dhaka', balance_due: 0 },
    { name: 'Renata Distribution Point', phone: '01644444444', address: 'Dhanmondi, Dhaka', balance_due: 3200 },
    { name: 'Healthcare Pharma Supplier', phone: '01555555555', address: 'Banani, Dhaka', balance_due: 0 },
    { name: 'SMC Distributor', phone: '01366666666', address: 'Mohakhali, Dhaka', balance_due: 1800 },
  ];
  const suppliers = [];
  for (const item of supplierSeeds) {
    const supplier = await Supplier.findOneAndUpdate(
      { business_id: businessId, name: item.name },
      { $setOnInsert: { business_id: businessId, ...item, is_active: true } },
      { upsert: true, new: true }
    );
    suppliers.push(supplier);
  }

  const existingSkus = new Set((await Medicine.find({ business_id: businessId, sku: { $in: medicineSeeds.map((m) => m.sku) } }).select('sku')).map((m) => m.sku));
  const newMedicineRows = medicineSeeds
    .filter((m) => !existingSkus.has(m.sku))
    .map((m) => {
      const piecesPerStrip = Math.max(Number(m.pieces_per_strip || 1), 1);
      const stripsPerBox = Math.max(Number(m.strips_per_box || 1), 1);
      const stripPrice = Number((Number(m.selling_price || 0) * piecesPerStrip).toFixed(2));
      const boxPrice = Number((stripPrice * stripsPerBox).toFixed(2));
      return {
        business_id: businessId,
        medicine_type: m.medicine_type,
        name: m.name,
        brand_name: m.brand_name,
        generic_name: m.generic_name,
        manufacturer: m.manufacturer,
        reason: m.reason,
        category: m.category,
        strength: m.strength,
        dosage_form: m.dosage_form,
        sku: m.sku,
        rack_location: m.rack_location,
        purchase_price: m.purchase_price,
        mrp: m.mrp,
        selling_price: m.selling_price,
        price: m.selling_price,
        strip_price: stripPrice,
        box_price: boxPrice,
        cost: m.purchase_price,
        barcode: m.barcode,
        batch_number: m.batch_number,
        pieces_per_strip: piecesPerStrip,
        strips_per_box: stripsPerBox,
        expiry_date: addDays(m.expiry_days),
        expiry_alert_days: m.expiry_alert_days,
        low_stock_threshold: m.low_stock_threshold,
        is_active: true,
      };
    });

  const meds = newMedicineRows.length ? await Medicine.insertMany(newMedicineRows) : [];

  const batchRows = [];
  for (const [index, med] of meds.entries()) {
    const original = medicineSeeds.find((m) => m.sku === med.sku) || {};
    const unitCost = Number(med.cost || med.purchase_price || 0);
    const isSingleUnitPack = ['Syrup', 'Suspension', 'Drops', 'Inhaler', 'Cream', 'Injection'].includes(String(med.medicine_type));
    const firstQty = isSingleUnitPack ? 24 + (index % 4) * 6 : 180 + (index % 5) * 40;
    const secondQty = isSingleUnitPack ? 12 + (index % 3) * 4 : 80 + (index % 4) * 30;
    batchRows.push({
      business_id: businessId,
      branch_id: mainBranch._id,
      medicine_id: med._id,
      batch_number: `${med.batch_number || original.batch_number}-A`,
      manufacturing_date: addDays(-220 - (index % 5) * 20),
      expiry_date: med.expiry_date,
      quantity: firstQty,
      available_quantity: firstQty,
      unit_cost: unitCost,
      purchase_price: unitCost,
      rack_location: med.rack_location,
      status: new Date(med.expiry_date).getTime() < Date.now() ? 'expired' : 'active',
    });
    batchRows.push({
      business_id: businessId,
      branch_id: secondBranch._id,
      medicine_id: med._id,
      batch_number: `${med.batch_number || original.batch_number}-B`,
      manufacturing_date: addDays(-120 - (index % 4) * 15),
      expiry_date: addDays(Math.max(Number(original.expiry_days || 365) + 180, 60)),
      quantity: secondQty,
      available_quantity: secondQty,
      unit_cost: unitCost,
      purchase_price: unitCost,
      rack_location: med.rack_location,
      status: 'active',
    });
  }
  const batches = batchRows.length ? await MedicineBatch.insertMany(batchRows) : [];
  for (const med of meds) await syncMedicineStock(med._id, businessId);

  if (batches.length) {
    const purchaseTotal = batches.reduce((sum, b) => sum + Number(b.quantity || 0) * Number(b.unit_cost || 0), 0);
    const paid = Number((purchaseTotal * 0.7).toFixed(2));
    const purchase = await Purchase.create({ business_id: businessId, supplier_id: suppliers[0]._id, branch_id: mainBranch._id, invoice_no: `PUR-BD-MOCK-${Date.now().toString().slice(-6)}`, total: Number(purchaseTotal.toFixed(2)), paid, due: Number((purchaseTotal - paid).toFixed(2)), status: purchaseTotal - paid > 0 ? 'partial' : 'paid', created_by: userId });
    await PurchaseItem.insertMany(batches.slice(0, 20).map((b) => {
      const med = meds.find((m) => String(m._id) === String(b.medicine_id));
      return { business_id: businessId, purchase_id: purchase._id, medicine_id: b.medicine_id, batch_id: b._id, name: med?.name || 'Medicine', quantity: b.quantity, unit_cost: Number(b.unit_cost || 0), line_total: Number((Number(b.quantity || 0) * Number(b.unit_cost || 0)).toFixed(2)) };
    }));
    await StockMovement.insertMany(batches.map((b) => ({ business_id: businessId, branch_id: b.branch_id, medicine_id: b.medicine_id, batch_id: b._id, type: 'purchase', quantity_in: b.quantity, quantity_out: 0, balance_after: b.available_quantity, reference: 'Bangladesh medicine mock opening stock', created_by: userId })));
  }

  const customerSeeds = [
    { name: 'Rahim Uddin', phone: '01744444444', address: 'Mohammadpur', due_balance: 420 },
    { name: 'Nusrat Jahan', phone: '01855555555', address: 'Banani', due_balance: 0 },
    { name: 'Farhana Akter', phone: '01977777777', address: 'Mirpur-10', due_balance: 260 },
  ];
  const customers = [];
  for (const customer of customerSeeds) {
    const row = await Customer.findOneAndUpdate(
      { business_id: businessId, phone: customer.phone },
      { $setOnInsert: { business_id: businessId, ...customer } },
      { upsert: true, new: true }
    );
    customers.push(row);
  }
  if (customers[0]) {
    await Prescription.findOneAndUpdate(
      { business_id: businessId, customer_id: customers[0]._id, doctor_name: 'Dr. Karim' },
      { $setOnInsert: { business_id: businessId, customer_id: customers[0]._id, doctor_name: 'Dr. Karim', notes: 'Demo prescription note: fever medicine after meal for 3 days.' } },
      { upsert: true, new: true }
    );
    await CustomerDue.findOneAndUpdate(
      { business_id: businessId, customer_id: customers[0]._id, amount: 420, status: 'open' },
      { $setOnInsert: { business_id: businessId, customer_id: customers[0]._id, amount: 420, paid: 0, balance: 420, status: 'open' } },
      { upsert: true, new: true }
    );
  }

  await Expense.findOneAndUpdate(
    { business_id: businessId, title: 'Pharmacy rent' },
    { $setOnInsert: { business_id: businessId, title: 'Pharmacy rent', category: 'Rent', amount: 18000, payment_method: 'cash', created_by: userId } },
    { upsert: true, new: true }
  );
  await CashRegister.findOneAndUpdate(
    { business_id: businessId, branch_id: mainBranch._id, status: 'open' },
    { $setOnInsert: { business_id: businessId, branch_id: mainBranch._id, cashier_id: userId, opening_cash: 5000, expected_cash: 5000, status: 'open' } },
    { upsert: true, new: true }
  );
  const roleSeeds = [
    { role: 'Owner', permissions: ['*'] },
    { role: 'Cashier', permissions: ['pos.sale', 'customer.read', 'receipt.print'] },
    { role: 'Inventory Manager', permissions: ['medicine.manage', 'purchase.manage', 'stock.adjust', 'report.inventory'] },
  ];
  for (const role of roleSeeds) {
    await RolePermission.findOneAndUpdate(
      { business_id: businessId, role: role.role },
      { $set: { business_id: businessId, role: role.role, permissions: role.permissions } },
      { upsert: true, new: true }
    );
  }

  await audit({ business_id: businessId, user_id: userId, action: 'bangladesh_mock_medicines_seeded', resource: 'pharmacy', details: { inserted_medicines: meds.length, inserted_batches: batches.length, total_seed_catalog: medicineSeeds.length }, req: null });
  return { seeded: meds.length > 0 || batches.length > 0, medicines: medicineSeeds.length, inserted_medicines: meds.length, batches: batches.length, suppliers: suppliers.length, customers: customers.length };
}

app.post('/api/pharmacy/mock-data', auth, async (req, res, next) => {
  try {
    await requirePharmacyBusiness(req.user.id);
    const result = await seedPharmacyMockData(req.user.id, req.user.id, { reset: Boolean(req.body?.reset), skipIfExists: !req.body?.reset });
    res.json({ data: result });
  } catch (err) { next(err); }
});

app.get('/api/pharmacy/dashboard', auth, async (req, res, next) => {
  try {
    await requirePharmacyBusiness(req.user.id);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [sales, monthSales, purchases, expenses, meds, batches, customers, suppliers] = await Promise.all([
      Sale.find({ business_id: req.user.id, created_at: { $gte: startToday } }),
      Sale.find({ business_id: req.user.id, created_at: { $gte: startMonth } }),
      Purchase.find({ business_id: req.user.id, purchase_date: { $gte: startMonth } }),
      Expense.find({ business_id: req.user.id, created_at: { $gte: startMonth } }),
      Medicine.find({ business_id: req.user.id, is_active: true }),
      MedicineBatch.find({ business_id: req.user.id }),
      Customer.find({ business_id: req.user.id }),
      Supplier.find({ business_id: req.user.id }),
    ]);
    const todaySales = sales.reduce((s, x) => s + Number(x.total || 0), 0);
    const monthlySales = monthSales.reduce((s, x) => s + Number(x.total || 0), 0);
    const monthlyPurchases = purchases.reduce((s, x) => s + Number(x.total || 0), 0);
    const monthlyExpenses = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
    const lowStock = meds.filter((m) => Number(m.pieces || 0) <= 20).length;
    const near30 = batches.filter((b) => b.expiry_date && new Date(b.expiry_date).getTime() >= startToday.getTime() && new Date(b.expiry_date).getTime() <= Date.now() + 30 * 86400000).length;
    const near90 = batches.filter((b) => b.expiry_date && new Date(b.expiry_date).getTime() >= startToday.getTime() && new Date(b.expiry_date).getTime() <= Date.now() + 90 * 86400000).length;
    const near180 = batches.filter((b) => b.expiry_date && new Date(b.expiry_date).getTime() >= startToday.getTime() && new Date(b.expiry_date).getTime() <= Date.now() + 180 * 86400000).length;
    const expired = batches.filter((b) => b.expiry_date && new Date(b.expiry_date).getTime() < startToday.getTime()).length;
    const stockValuation = batches.reduce((s, b) => s + Number(b.available_quantity || 0) * Number(b.unit_cost || 0), 0);
    const supplierDue = suppliers.reduce((s, x) => s + Number(x.balance_due || 0), 0);
    const customerDue = customers.reduce((s, x) => s + Number(x.due_balance || 0), 0);
    res.json({ data: { today_sales: todaySales, monthly_sales: monthlySales, monthly_purchases: monthlyPurchases, monthly_expenses: monthlyExpenses, estimated_profit: monthlySales - monthlyPurchases - monthlyExpenses, low_stock: lowStock, expired, near_30: near30, near_90: near90, near_180: near180, stock_valuation: stockValuation, supplier_due: supplierDue, customer_due: customerDue } });
  } catch (err) { next(err); }
});

app.post('/api/pharmacy/pos/sale', auth, async (req, res, next) => {
  try {
    await requirePharmacyBusiness(req.user.id);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: 'Cart is empty.' });
    const paymentMethod = String(req.body.payment_method || 'cash');
    const discount = Math.max(Number(req.body.discount || 0), 0);
    const customerId = req.body.customer_id || null;
    const branchId = req.body.branch_id || null;
    const customerName = String(req.body.customer_name || '').trim() || null;
    const customerPhone = String(req.body.customer_phone || '').trim() || null;
    if (paymentMethod === 'due' && !customerId) return res.status(400).json({ message: 'Due sale requires a customer. Select or add a customer first.' });
    const dbCustomer = customerId ? await Customer.findOne({ _id: customerId, business_id: req.user.id }) : null;
    if (paymentMethod === 'due' && !dbCustomer) return res.status(404).json({ message: 'Selected due customer was not found.' });
    const saleCustomerName = customerName || dbCustomer?.name || null;
    const saleCustomerPhone = customerPhone || dbCustomer?.phone || null;
    const dueAmount = paymentMethod === 'due' ? Math.max(Number(req.body.due_amount || 0), 0) : 0;
    const paidAmount = paymentMethod === 'due' ? Math.max(Number(req.body.paid_amount || 0), 0) : 0;
    let subtotal = 0;
    const saleItems = [];
    const movements = [];

    for (const line of items) {
      const medicine = await Medicine.findOne({ _id: line.medicine_id, business_id: req.user.id, is_active: true });
      if (!medicine) return res.status(404).json({ message: 'Medicine not found.' });
      const unit = String(line.unit || 'piece');
      const requestedUnits = Math.max(Number(line.quantity || 0), 0);
      if (requestedUnits <= 0) return res.status(400).json({ message: 'Invalid quantity.' });
      const piecesPerStrip = Math.max(Number(medicine.pieces_per_strip || 1), 1);
      const stripsPerBox = Math.max(Number(medicine.strips_per_box || 1), 1);
      const multiplier = unit === 'box' ? piecesPerStrip * stripsPerBox : unit === 'strip' ? piecesPerStrip : 1;
      let piecesNeeded = requestedUnits * multiplier;
      const unitPrice = unit === 'box' && medicine.box_price ? Number(medicine.box_price) : unit === 'strip' && medicine.strip_price ? Number(medicine.strip_price) : Number(medicine.price || medicine.selling_price || 0);
      subtotal += requestedUnits * unitPrice;
      const batches = await MedicineBatch.find({ business_id: req.user.id, medicine_id: medicine._id, status: 'active', available_quantity: { $gt: 0 }, ...(branchId ? { branch_id: branchId } : {}) }).sort({ expiry_date: 1, created_at: 1 });
      for (const batch of batches) {
        if (piecesNeeded <= 0) break;
        const take = Math.min(Number(batch.available_quantity || 0), piecesNeeded);
        if (take <= 0) continue;
        batch.available_quantity = Number(batch.available_quantity || 0) - take;
        await batch.save();
        piecesNeeded -= take;
        movements.push({ business_id: req.user.id, branch_id: batch.branch_id, medicine_id: medicine._id, batch_id: batch._id, type: 'sale', quantity_in: 0, quantity_out: take, balance_after: batch.available_quantity, reference: 'FEFO POS sale', created_by: req.user.id });
      }
      if (piecesNeeded > 0) return res.status(409).json({ message: `Not enough stock for ${medicine.name}.` });
      saleItems.push({ product_id: medicine._id, name: `${medicine.name} (${requestedUnits} ${unit})`, unit_price: unitPrice, quantity: requestedUnits, line_total: requestedUnits * unitPrice });
      await syncMedicineStock(medicine._id, req.user.id);
    }

    const total = Math.max(subtotal - discount, 0);
    const finalPaidAmount = paymentMethod === 'due' ? Math.min(paidAmount, total) : total;
    const finalDueAmount = paymentMethod === 'due' ? Math.max(dueAmount || (total - finalPaidAmount), 0) : 0;
    const sale = await Sale.create({
      business_id: req.user.id,
      subtotal,
      discount,
      total,
      payment_method: paymentMethod,
      status: paymentMethod === 'due' ? 'due' : 'completed',
      customer_id: customerId,
      customer_name: saleCustomerName,
      customer_phone: saleCustomerPhone,
      paid_amount: finalPaidAmount,
      due_amount: finalDueAmount,
      note: req.body.note || null,
      created_by: req.user.id,
    });
    await SaleItem.insertMany(saleItems.map((x) => ({ ...x, sale_id: sale._id, business_id: req.user.id })));
    if (movements.length) await StockMovement.insertMany(movements.map((m) => ({ ...m, reference: `SALE-${sale._id}` })));
    if (paymentMethod === 'due' && customerId) {
      const balance = finalDueAmount;
      await CustomerDue.create({ business_id: req.user.id, customer_id: customerId, sale_id: sale._id, amount: total, paid: finalPaidAmount, balance, status: balance > 0 ? 'open' : 'paid' });
      await Customer.findOneAndUpdate({ _id: customerId, business_id: req.user.id }, { $inc: { due_balance: balance }, $set: { ...(saleCustomerPhone ? { phone: saleCustomerPhone } : {}) } });
    }
    await audit({ business_id: req.user.id, user_id: req.user.id, action: 'fefo_pos_sale', resource: 'sales', resource_id: sale._id, details: { total, payment_method: paymentMethod, items: saleItems.length }, req });
    const rows = await SaleItem.find({ sale_id: sale._id, business_id: req.user.id });
    res.status(201).json({ data: { sale: clean(sale), items: rows.map(clean) } });
  } catch (err) { next(err); }
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
