/* node scripts/test-spending-tools.js — 독립적인 계산·입력 경계 검증 */
const assert = require('node:assert/strict');
const { readInteger, readQuantity, readUnit, calculateShipping, calculateSubscription, calculateUnitPrice, MAX_WON, MAX_QUANTITY } = require('../js/spending-tools.js');

const shipping = (overrides = {}) => calculateShipping({ basket: 28000, fee: 3000, threshold: 40000, extra: 12000, ...overrides });
assert.equal(shipping().beforeTotal, 31000);
assert.equal(shipping().afterTotal, 40000);
assert.equal(shipping().difference, 9000);
assert.equal(shipping().remaining, 0);
// 기준 미달이면 추가한 뒤에도 배송비를 냅니다.
assert.equal(shipping({ extra: 11999 }).afterFee, 3000);
assert.equal(shipping({ extra: 11999 }).remaining, 1);
assert.equal(shipping({ extra: 11999 }).difference, 11999);
// 필요한 상품만으로 기준을 충족한 경우에는 양쪽 모두 배송비가 없습니다.
assert.equal(shipping({ basket: 40000 }).beforeFee, 0);
assert.equal(shipping({ basket: 40000 }).afterFee, 0);
assert.equal(shipping({ basket: 40000 }).difference, 12000);
assert.equal(shipping({ basket: 50000 }).beforeFee, 0);
assert.equal(shipping({ threshold: 0 }).beforeFee, 0);
assert.equal(shipping({ threshold: 0 }).afterFee, 0);
// 배송비보다 저렴한 필요 상품을 보태는 경우·같은 총액·아무것도 보태지 않는 경우.
assert.equal(shipping({ basket: 39000, extra: 1000 }).difference, -2000);
assert.equal(shipping({ basket: 37000, extra: 3000 }).difference, 0);
assert.equal(shipping({ extra: 0 }).difference, 0);
assert.equal(shipping({ fee: 0 }).difference, 12000);
assert.equal(shipping({ basket: MAX_WON, extra: MAX_WON }).afterTotal, MAX_WON * 2);

const subscription = (overrides = {}) => calculateSubscription({ monthly: 12000, uses: 4, single: 4000, ...overrides });
assert.equal(subscription().perUse, 3000);
assert.equal(subscription().separateTotal, 16000);
assert.equal(subscription().difference, -4000);
assert.equal(subscription({ uses: 1 }).difference, 8000);
assert.equal(subscription({ uses: 3 }).difference, 0);
assert.equal(subscription({ uses: 0 }).perUse, null);
assert.equal(subscription({ uses: 0 }).separateTotal, 0);
assert.equal(subscription({ monthly: 0, single: 0 }).difference, 0);
assert.equal(subscription({ single: 0 }).difference, 12000);
assert.equal(subscription({ monthly: 100, uses: 3 }).perUse, 100 / 3);
assert.equal(subscription({ uses: 10000, single: MAX_WON }).separateTotal, 1000000000000);

for (const invalid of ['', ' ', null, undefined, -1, '-1', '1.5', 1.5, '1e3', Infinity, 'Infinity', NaN, 'NaN', '1,000', 'abc', {}, true, MAX_WON + 1, '999999999999999999999']) {
  assert.throws(() => readInteger(invalid, '금액'), undefined, '거절해야 하는 입력: ' + String(invalid));
}
assert.equal(readInteger(' 12000 ', '금액'), 12000);
assert.equal(readInteger(0, '금액'), 0);
assert.equal(readInteger(MAX_WON, '금액'), MAX_WON);
assert.throws(() => subscription({ uses: 10001 }));
assert.throws(() => shipping({ basket: '' }));
assert.throws(() => subscription({ monthly: '' }));
console.log('소비 비교 도구 검증 통과: 무료 배송 기준 전후·총액 증감·구독 0회/동일 비용·입력 범위와 잘못된 값');


// Compare supplied and actually used quantities without making a quality judgment.
const unitPrice = (overrides = {}) => calculateUnitPrice({ aPrice: 3600, aQuantity: 400, aUse: 400, aUnit: 'g',
  bPrice: 4200, bQuantity: 500, bUse: 400, bUnit: 'g', ...overrides });
assert.deepEqual(unitPrice(), {
  a: { totalPrice: 3600, receivedBase: 400, usedBase: 400, leftoverBase: 0, perReceived: 900, perUsed: 900 },
  b: { totalPrice: 4200, receivedBase: 500, usedBase: 400, leftoverBase: 100, perReceived: 840, perUsed: 1050 },
  baseUnit: 'g', basis: 100, priceDifference: 600,
});
// Equivalent quantities must give identical results after kg/L conversion.
assert.deepEqual(unitPrice({ aQuantity: '0.4', aUse: '0.4', aUnit: 'kg', bQuantity: '0.5', bUse: '0.4', bUnit: 'kg' }), unitPrice());
assert.deepEqual(unitPrice({ aQuantity: '0.4', aUse: '0.4', aUnit: 'kg' }), unitPrice());
const volume = unitPrice({ aQuantity: 750, aUse: 500, aUnit: 'mL', bQuantity: 1000, bUse: 500, bUnit: 'mL' });
assert.deepEqual(unitPrice({ aQuantity: '0.75', aUse: '0.5', aUnit: 'L', bQuantity: 1, bUse: '0.5', bUnit: 'L' }), volume);
assert.equal(volume.baseUnit, 'mL');
assert.equal(volume.basis, 100);
assert.equal(volume.a.perReceived, 480);
assert.equal(volume.a.perUsed, 720);
assert.equal(unitPrice({ aUse: 0 }).a.perUsed, null);
assert.equal(unitPrice({ aUse: 0 }).a.leftoverBase, 400);
assert.equal(unitPrice({ aUse: 400 }).a.leftoverBase, 0);
assert.equal(unitPrice({ aPrice: 0 }).a.perReceived, 0);
assert.equal(unitPrice({ aPrice: 0 }).a.perUsed, 0);
assert.equal(unitPrice({ aPrice: 0, aUse: 0 }).a.perUsed, null);
assert.equal(unitPrice({ aQuantity: '0.003', aUse: '0.001' }).a.leftoverBase, 0.002);
assert.equal(unitPrice({ aQuantity: MAX_QUANTITY, aUse: MAX_QUANTITY, aUnit: 'kg' }).a.receivedBase, 1000000000);
assert.equal(unitPrice({ aPrice: MAX_WON, aQuantity: '0.001', aUse: '0.001' }).a.perUsed, 10000000000000);
const count = unitPrice({ aQuantity: 3, aUse: 2, aUnit: '개', bQuantity: 4, bUse: 2, bUnit: '개' });
assert.equal(count.baseUnit, '개');
assert.equal(count.basis, 1);
assert.equal(count.a.perReceived, 1200);
assert.equal(count.a.perUsed, 1800);
assert.equal(count.b.leftoverBase, 2);
assert.equal(unitPrice({ bPrice: 3500 }).priceDifference, -100);
assert.equal(unitPrice({ bPrice: 3600 }).priceDifference, 0);
const rejectsField = (overrides, field) => assert.throws(() => unitPrice(overrides), (error) => error.field === field);
rejectsField({ aQuantity: 0 }, 'aQuantity');
rejectsField({ bQuantity: 0 }, 'bQuantity');
rejectsField({ aUse: 401 }, 'aUse');
rejectsField({ bUse: 501 }, 'bUse');
rejectsField({ bUnit: 'mL' }, 'bUnit');
rejectsField({ aUnit: '개', bUnit: '개', aQuantity: 1.5, aUse: 1 }, 'aQuantity');
rejectsField({ aUnit: '개', bUnit: '개', aQuantity: 1.5, aUse: 2 }, 'aQuantity');
rejectsField({ aUnit: '개', bUnit: '개', aUse: 0.5 }, 'aUse');
rejectsField({ aUnit: '개', bUnit: '개', bQuantity: 500.5 }, 'bQuantity');
rejectsField({ aUnit: '개', bUnit: '개', bUse: 0.5 }, 'bUse');
for (const invalid of ['', ' ', null, undefined, -1, '-1', '1.0001', 0.0001, '1e3', Infinity, NaN,
  'NaN', '1,000', '.5', '1.', 'abc', {}, true, MAX_QUANTITY + 1, '999999999999999999999']) {
  assert.throws(() => readQuantity(invalid, '수량'), undefined, 'Invalid quantity: ' + String(invalid));
}
for (const invalid of ['ml', 'G', 'KG', 'l', 'kg/mL', '박스', '__proto__', 'constructor', {}, null, Infinity]) {
  assert.throws(() => readUnit(invalid, '단위'));
}
assert.equal(readQuantity(' 0.001 ', '수량'), 0.001);
assert.equal(readQuantity('1000000.000', '수량'), MAX_QUANTITY);
assert.equal(readQuantity(0, '수량'), 0);
assert.equal(readUnit(' kg ', '단위'), 'kg');
rejectsField({ aPrice: -1 }, 'aPrice');
rejectsField({ bPrice: MAX_WON + 1 }, 'bPrice');
rejectsField({ aQuantity: MAX_QUANTITY + 1 }, 'aQuantity');
rejectsField({ bUse: MAX_QUANTITY + 1 }, 'bUse');
rejectsField({ aUnit: '__proto__' }, 'aUnit');
rejectsField({ bUse: '0.0001' }, 'bUse');

// Exercise the browser contract: inline cross-field errors, focus, stale results, and selects.
const vm = require('node:vm');
const fs = require('node:fs');
const element = () => ({ value: '', hidden: true, textContent: '', handlers: {}, attributes: {},
  addEventListener(type, fn) { this.handlers[type] = fn; },
  setAttribute(key, value) { this.attributes[key] = value; },
  removeAttribute(key) { delete this.attributes[key]; },
  focus() { this.focused = true; },
});
const nodes = new Map();
for (const selector of ['form', '[data-tool-result]', '[data-tool-status]', '[data-tool-errors]', '[data-calculate]', '[data-example]']) nodes.set(selector, element());
for (const key of ['aPrice', 'aQuantity', 'aUse', 'aUnit', 'bPrice', 'bQuantity', 'bUse', 'bUnit']) {
  nodes.set('[data-field="' + key + '"]', element());
  nodes.set('[data-error="' + key + '"]', element());
}
for (const key of ['a-total', 'b-total', 'a-received', 'b-received', 'a-used', 'b-used', 'a-left', 'b-left', 'a-unit-price', 'b-unit-price', 'a-use-price', 'b-use-price', 'summary', 'condition']) {
  nodes.set('[data-result="' + key + '"]', element());
}
const section = { querySelector: (selector) => { assert.ok(nodes.has(selector), 'Expected DOM selector: ' + selector); return nodes.get(selector); } };
vm.runInNewContext(fs.readFileSync(require.resolve('../js/spending-tools.js'), 'utf8'), {
  document: { readyState: 'complete', getElementById: (id) => id === 'unit-price-calculator' ? section : null },
});
const field = (key) => nodes.get('[data-field="' + key + '"]');
const result = nodes.get('[data-tool-result]');
const output = (key) => nodes.get('[data-result="' + key + '"]').textContent;
const example = () => nodes.get('[data-example]').handlers.click();
const calculate = () => nodes.get('[data-calculate]').handlers.click();
assert.equal(nodes.get('form').hidden, false);
example();
assert.equal(result.hidden, false);
assert.equal(output('b-left'), '100g');
assert.equal(output('b-unit-price'), '약 840원 / 100g');
assert.equal(output('b-use-price'), '약 1,050원 / 100g');
field('aUse').value = '401';
field('aUse').handlers.input();
assert.equal(result.hidden, true);
calculate();
assert.equal(field('aUse').attributes['aria-invalid'], 'true');
assert.equal(field('aUse').focused, true);
assert.match(nodes.get('[data-error="aUse"]').textContent, /받는 총량/);
assert.equal(result.hidden, true);
example();
field('bUnit').value = 'mL';
field('bUnit').handlers.change();
assert.equal(result.hidden, true);
calculate();
assert.equal(field('bUnit').attributes['aria-invalid'], 'true');
assert.equal(field('bUnit').focused, true);
example();
field('aUse').value = '0';
calculate();
assert.match(output('a-use-price'), /0: 계산하지/);
assert.doesNotMatch(output('a-use-price'), /약 0원/);
example();
field('aPrice').value = '1';
field('aQuantity').value = '1000000';
field('aUse').value = '1000000';
calculate();
assert.equal(output('a-unit-price'), '0.01원 미만 / 100g');
assert.equal(output('a-use-price'), '0.01원 미만 / 100g');
example();
field('aPrice').value = '-1';
field('bQuantity').value = '0.0001';
calculate();
assert.equal(field('aPrice').attributes['aria-invalid'], 'true');
assert.equal(field('aPrice').focused, true);
assert.equal(field('bQuantity').attributes['aria-invalid'], 'true');
console.log('Unit-price tests passed: conversions, usable quantity, boundaries, invalid inputs, inline errors and stale-result handling.');
