// Run only against a disposable staging database; creates test businesses and sales.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=(process.env.STAGING_API_URL||'').replace(/\/$/,'');
if(!base.endsWith('/api') || process.env.ALLOW_STAGING_WRITES!=='YES') throw Error('Set STAGING_API_URL (ending in /api) and ALLOW_STAGING_WRITES=YES for an isolated staging database.');
async function call(path,method='GET',body,token,expected=200){
 const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const json=await res.json(); assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(json)}`); return json;
}
async function register(category){const email=`smoke-${randomUUID()}@example.invalid`;return (await call('/auth/register','POST',{email,password:'TestOnly!'+randomUUID(),business_name:'STAGING SMOKE '+category,category,owner_name:'Test',phone:'000',address:'Test'},null,201)).token;}
await call('/health');const a=await register('shop'), b=await register('shop');
const info=(await call('/subscription','GET',undefined,a)).data; assert.equal(info.subscription.status,'trialing'); assert.equal(info.subscription.active,true); assert.equal(new Date(info.business.trial_ends_at)-new Date(info.business.trial_starts_at),7*86400000);
await call('/data/businesses?single=true','PATCH',{subscription_status:'active'},a,403);
await call('/data/payment_transactions','POST',{status:'paid'},a,403);
const product=(await call('/data/products','POST',{name:'Test item',price:100,stock:3},a,201)).data;
assert.equal((await call(`/data/products?id=${product.id}&single=true`,'GET',undefined,b)).data,null);
await call(`/data/products?id=${product.id}`,'PATCH',{stock:999},b,404);
const body={request_id:randomUUID(),items:[{product_id:product.id,quantity:2,unit_price:100}],payment_method:'cash',discount:0};
const first=(await call('/pos/sale','POST',body,a,201)).data; assert.equal(first.sale.total,200);
const repeat=(await call('/pos/sale','POST',body,a,201)).data;assert.equal(first.sale.id,repeat.sale.id);
await call('/pos/sale','POST',{...body,request_id:randomUUID()},a,409);
assert.equal((await call(`/data/products?id=${product.id}&single=true`,'GET',undefined,a)).data.stock,1);
await call('/data/sales','POST',{total:1},a,403);
const dash=(await call('/mobile/dashboard','GET',undefined,a)).data;
assert.equal(dash.inventory.find(x=>x.id===product.id).stock,1);
assert.equal(dash.sales.filter(x=>x.id===first.sale.id).length,1);
const otherDash=(await call('/mobile/dashboard','GET',undefined,b)).data;
assert.equal(otherDash.inventory.some(x=>x.id===product.id),false);
assert.equal(otherDash.sales.some(x=>x.id===first.sale.id),false);
await call('/mobile/dashboard','GET',undefined,null,401);
const joined=(await call('/data/sales?select=*,sale_items(*)','GET',undefined,a)).data;
assert.equal(joined.find(x=>x.id===first.sale.id).sale_items.length,1);
const lpg=await register('lpg_cylinder');
async function cylinder(company){return (await call('/data/lpg_cylinders','POST',{company,cylinder_size:'12 kg',price:1450,gas_price:1450,bottle_price:1800,full_stock:3,empty_stock:0,item_type:'refill'},lpg,201)).data;}
const x=await cylinder('Test A'), y=await cylinder('Test B');
const refill={request_id:randomUUID(),payment_method:'cash',items:[{cylinder_id:x.id,quantity:1,item_type:'refill',unit_price:1450,empty_return_quantity:1,empty_return_cylinder_id:y.id}]};
const l=(await call('/lpg/pos/sale','POST',refill,lpg,201)).data;assert.equal(l.sale.total,1450);
assert.equal((await call('/lpg/pos/sale','POST',refill,lpg,201)).data.sale.id,l.sale.id);
assert.equal((await call(`/data/lpg_cylinders?id=${y.id}&single=true`,'GET',undefined,lpg)).data.empty_stock,1);
const pack=(await call('/lpg/pos/sale','POST',{request_id:randomUUID(),payment_method:'cash',items:[{cylinder_id:x.id,quantity:1,item_type:'package',unit_price:3250,empty_return_quantity:0}]},lpg,201)).data;assert.equal(pack.sale.total,3250);
assert.equal((await call(`/data/lpg_cylinders?id=${x.id}&single=true`,'GET',undefined,lpg)).data.full_stock,1);
console.log('Staging smoke tests passed. Test data remains in the disposable staging database.');
