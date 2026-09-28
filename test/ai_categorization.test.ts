/**
 * PRYORA AI Auto-Categorization Test Suite
 */

process.env.NODE_ENV = 'test';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { suggestCategoryForMerchant } from '../server/services/geminiService.js';

describe('PRYORA AI Auto-Categorization', () => {
  const sampleCategories = [
    { id: 'cat_food', name: 'Food & Dining' },
    { id: 'cat_grocery', name: 'Groceries & Supplies' },
    { id: 'cat_transit', name: 'Transportation' },
    { id: 'cat_sub', name: 'Subscriptions' },
    { id: 'cat_util', name: 'Utilities & Bills' },
    { id: 'cat_shop', name: 'Shopping & Essentials' },
    { id: 'cat_health', name: 'Health & Medical' },
    { id: 'cat_ent', name: 'Entertainment & Leisure' },
    { id: 'cat_other', name: 'Other Expense' },
  ];

  test('Auto-categorizes dining merchants correctly', async () => {
    const res1 = await suggestCategoryForMerchant('Starbucks Coffee', sampleCategories);
    assert.equal(res1.categoryId, 'cat_food');
    assert.equal(res1.categoryName, 'Food & Dining');
    assert.ok(res1.confidence >= 0.7);

    const res2 = await suggestCategoryForMerchant('Swiggy Order #84920', sampleCategories);
    assert.equal(res2.categoryId, 'cat_food');
    assert.equal(res2.categoryName, 'Food & Dining');

    const res3 = await suggestCategoryForMerchant('McDonalds Drive-thru', sampleCategories);
    assert.equal(res3.categoryId, 'cat_food');
  });

  test('Auto-categorizes transit and fuel merchants correctly', async () => {
    const res1 = await suggestCategoryForMerchant('Uber Trip', sampleCategories);
    assert.equal(res1.categoryId, 'cat_transit');
    assert.equal(res1.categoryName, 'Transportation');

    const res2 = await suggestCategoryForMerchant('Shell Gas Station', sampleCategories);
    assert.equal(res2.categoryId, 'cat_transit');

    const res3 = await suggestCategoryForMerchant('City Metro Card Recharge', sampleCategories);
    assert.equal(res3.categoryId, 'cat_transit');
  });

  test('Auto-categorizes subscriptions and recurring services correctly', async () => {
    const res1 = await suggestCategoryForMerchant('Netflix.com/Payment', sampleCategories);
    assert.equal(res1.categoryId, 'cat_sub');
    assert.equal(res1.categoryName, 'Subscriptions');

    const res2 = await suggestCategoryForMerchant('Spotify Premium Family', sampleCategories);
    assert.equal(res2.categoryId, 'cat_sub');
  });

  test('Auto-categorizes grocery stores correctly', async () => {
    const res1 = await suggestCategoryForMerchant('Whole Foods Market', sampleCategories);
    assert.equal(res1.categoryId, 'cat_grocery');
    assert.equal(res1.categoryName, 'Groceries & Supplies');

    const res2 = await suggestCategoryForMerchant('Trader Joe Organic Groceries', sampleCategories);
    assert.equal(res2.categoryId, 'cat_grocery');
  });

  test('Auto-categorizes healthcare and pharmacies correctly', async () => {
    const res = await suggestCategoryForMerchant('CVS Pharmacy #4029', sampleCategories);
    assert.equal(res.categoryId, 'cat_health');
    assert.equal(res.categoryName, 'Health & Medical');
  });

  test('Handles empty or unknown merchants safely without throwing', async () => {
    const emptyRes = await suggestCategoryForMerchant('', sampleCategories);
    assert.equal(emptyRes.categoryId, null);

    const unknownRes = await suggestCategoryForMerchant('RandomXYZ Unknown Merchant 1234', sampleCategories);
    assert.ok(unknownRes.categoryName);
  });
});
