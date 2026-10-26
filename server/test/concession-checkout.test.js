import assert from 'node:assert/strict';
import { test } from 'node:test';
import { concessionQuoteSchema, concessionSelectionSchema } from '../src/modules/concession/checkout.validation.js';
import { runMigration } from '../src/migrations/20261025-concession-checkout.js';

test('CON-102 selection rejects client price/branch/owner, duplicates and invalid quantity', () => {
  const line = {itemType:'CONCESSION',itemId:'a'.repeat(24),quantity:1};
  const quote = {holdId:'b'.repeat(24),items:[line]};
  assert.equal(concessionQuoteSchema.safeParse(quote).success,true);
  assert.equal(concessionQuoteSchema.safeParse({...quote,items:[]}).success,true);
  for (const extra of [{branchId:'c'.repeat(24)},{ownerId:'c'.repeat(24)},{amount:0}]) assert.equal(concessionQuoteSchema.safeParse({...quote,...extra}).success,false);
  for (const quantity of [-1,0,1.5,101,'1']) assert.equal(concessionQuoteSchema.safeParse({...quote,items:[{...line,quantity}]}).success,false);
  assert.equal(concessionQuoteSchema.safeParse({...quote,items:[line,line]}).success,false);
  assert.equal(concessionSelectionSchema.safeParse({quoteReference:'a'.repeat(64),items:[]}).success,false);
  assert.equal(concessionSelectionSchema.safeParse({quoteReference:'forged',items:[line]}).success,false);
});

test('CON-102 migration defaults to no connection/dry run and requires explicit database', async () => {
  const previous = process.env.MONGODB_URI;
  process.env.MONGODB_URI = 'invalid://dry-run-must-not-connect';
  try {
    await runMigration(['--db','con102_dry_run']);
    await assert.rejects(runMigration([]), /Explicit/);
    await assert.rejects(runMigration(['--db','--apply']), /Explicit/);
    await assert.rejects(runMigration(['--db','con102_dry_run','--apply']), /Remote apply/);
  } finally {
    if (previous === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previous;
  }
});
