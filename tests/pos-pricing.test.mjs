import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePosPricing } from '../src/staff/posPricing.ts';
test('unconfigured tax preserves established checkout amounts', () => {
  const pricing=calculatePosPricing(2499,'','exclusive');
  assert.equal(pricing.configured,false);assert.equal(pricing.total,2499);assert.equal(pricing.tax,0);
});
test('exclusive tax produces one rounded gross amount for checkout and transaction snapshots', () => {
  const pricing=calculatePosPricing(2499,'12','exclusive');
  assert.equal(pricing.tax,299.88);assert.equal(pricing.total,2798.88);assert.equal(pricing.base,2499);
});
test('inclusive tax is extracted without taxing the gross price twice', () => {
  const pricing=calculatePosPricing(112,'12','inclusive');
  assert.equal(pricing.tax,12);assert.equal(pricing.base,100);assert.equal(pricing.total,112);
});
test('zero tax is explicit and fractional-cent taxes round once', () => {
  assert.equal(calculatePosPricing(100,'0','exclusive').configured,true);
  assert.equal(calculatePosPricing(0.05,'10','exclusive').total,0.06);
  const p=calculatePosPricing(99.99,'7.5','inclusive');
  assert.equal(Math.round((p.base+p.tax)*100),9999);
});
test('invalid tax configuration blocks checkout calculations', () => {
  for(const rate of ['no','-1','101','Infinity']) assert.throws(()=>calculatePosPricing(100,rate,'exclusive'));
  assert.throws(()=>calculatePosPricing(-1,'12','exclusive'));
  assert.throws(()=>calculatePosPricing(NaN,'12','exclusive'));
  assert.throws(()=>calculatePosPricing(100,'12','unknown'));
});
