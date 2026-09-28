/* node scripts/test-spending-tools.js — 독립적인 계산·입력 경계 검증 */
const assert = require('node:assert/strict');
const { readInteger, calculateShipping, calculateSubscription, MAX_WON } = require('../js/spending-tools.js');

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
