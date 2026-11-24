import 'dotenv/config';
import mongoose from 'mongoose';
// Run in a controlled maintenance window with the target database credentials.
if (process.env.ALLOW_INDEX_CREATION !== 'YES' || !process.env.MONGODB_URI) throw new Error('Set MONGODB_URI and ALLOW_INDEX_CREATION=YES. Confirm the target database first.');
await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
try {
  const db=mongoose.connection.db;
  const collections=await db.listCollections({}, {nameOnly:true}).toArray();
  const exists=new Set(collections.map(x=>x.name));
  // Standard Mongoose collection names in CounterPOS. Do not create unused collections.
  for (const name of ['products','medicines','dresses','lpgcylinders','sales','expenses','customers','paymenttransactions']) {
    if (!exists.has(name)) continue;
    const index=await db.collection(name).createIndex({business_id:1,created_at:-1});
    console.log(`${name}: ${index}`);
  }
  if(exists.has('saleitems')) console.log('saleitems:',await db.collection('saleitems').createIndex({business_id:1,sale_id:1}));
  if(exists.has('medicinebatches')) console.log('medicinebatches:',await db.collection('medicinebatches').createIndex({business_id:1,medicine_id:1,status:1,expiry_date:1,created_at:1}));
  console.log('Additive performance indexes complete. No business records changed.');
} finally { await mongoose.disconnect(); }
