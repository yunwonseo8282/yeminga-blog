/* 입력값은 이 브라우저에서만 계산합니다. 통신이나 저장 기능은 사용하지 않습니다. */
(function () {
  'use strict';

  const MAX_WON = 100000000;
  const MAX_USES = 10000;
  const won = (value) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value) + '원';

  function readInteger(value, label, maximum = MAX_WON) {
    const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
    if (!raw) throw new Error(label + ': 값을 입력해 주세요.');
    if (!/^\d+$/.test(raw)) throw new Error(label + ': 쉼표 없이 0 이상의 정수로 입력해 주세요.');
    const number = Number(raw);
    if (!Number.isSafeInteger(number) || number > maximum) {
      throw new Error(label + ': ' + maximum.toLocaleString('ko-KR') + ' 이하로 입력해 주세요.');
    }
    return number;
  }

  function calculateShipping(values) {
    const basket = readInteger(values.basket, '필요한 상품 금액');
    const fee = readInteger(values.fee, '기본 배송비');
    const threshold = readInteger(values.threshold, '무료 배송 기준');
    const extra = readInteger(values.extra, '추가 상품 금액');
    const beforeFee = basket >= threshold ? 0 : fee;
    const afterFee = basket + extra >= threshold ? 0 : fee;
    const beforeTotal = basket + beforeFee;
    const afterTotal = basket + extra + afterFee;
    return { basket, fee, threshold, extra, beforeFee, afterFee, beforeTotal, afterTotal,
      difference: afterTotal - beforeTotal, remaining: Math.max(0, threshold - basket - extra) };
  }

  function calculateSubscription(values) {
    const monthly = readInteger(values.monthly, '한 달 구독료');
    const uses = readInteger(values.uses, '예상 이용 횟수', MAX_USES);
    const single = readInteger(values.single, '한 번씩 따로 이용할 때의 가격');
    const separateTotal = uses * single;
    return { monthly, uses, single, separateTotal, perUse: uses === 0 ? null : monthly / uses,
      difference: monthly - separateTotal };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { readInteger, calculateShipping, calculateSubscription, MAX_WON, MAX_USES };
  }
  if (typeof document === 'undefined') return;

  function setupTool(id, fields, examples, calculate, render) {
    const section = document.getElementById(id);
    if (!section) return;
    const form = section.querySelector('form');
    const result = section.querySelector('[data-tool-result]');
    const status = section.querySelector('[data-tool-status]');
    const errorSummary = section.querySelector('[data-tool-errors]');
    const fieldElements = fields.map((field) => ({ ...field,
      input: section.querySelector('[data-field="' + field.key + '"]'),
      error: section.querySelector('[data-error="' + field.key + '"]'),
    }));
    const set = (key, value) => { section.querySelector('[data-result="' + key + '"]').textContent = value; };
    const clearError = (field) => {
      field.input.removeAttribute('aria-invalid');
      field.error.textContent = '';
    };
    const run = () => {
      const values = {};
      let firstInvalid = null;
      errorSummary.textContent = '';
      fieldElements.forEach((field) => {
        clearError(field);
        try { values[field.key] = readInteger(field.input.value, field.label, field.maximum); }
        catch (error) {
          field.input.setAttribute('aria-invalid', 'true');
          field.error.textContent = error.message;
          firstInvalid = firstInvalid || field.input;
        }
      });
      if (firstInvalid) {
        result.hidden = true;
        status.textContent = '';
        errorSummary.textContent = '입력한 값을 확인해 주세요. 오류가 있는 항목 아래에 이유를 표시했어요.';
        firstInvalid.focus();
        return;
      }
      render(calculate(values), set);
      status.textContent = '';
      result.hidden = false;
    };
    form.addEventListener('submit', (event) => { event.preventDefault(); run(); });
    form.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing && fieldElements.some((field) => field.input === event.target)) {
        event.preventDefault();
        run();
      }
    });
    section.querySelector('[data-calculate]').addEventListener('click', run);
    section.querySelector('[data-example]').addEventListener('click', () => {
      fieldElements.forEach((field) => { field.input.value = examples[field.key]; });
      run();
    });
    fieldElements.forEach((field) => field.input.addEventListener('input', () => {
      clearError(field);
      errorSummary.textContent = '';
      result.hidden = true;
      status.textContent = '값을 바꿨어요. 비교하기를 눌러 새 결과를 확인해 주세요.';
    }));
    form.hidden = false;
  }

  function initTools() {
    setupTool('shipping-calculator', [
      { key: 'basket', label: '필요한 상품 금액' }, { key: 'fee', label: '기본 배송비' },
      { key: 'threshold', label: '무료 배송 기준' }, { key: 'extra', label: '추가 상품 금액' },
    ], { basket: 28000, fee: 3000, threshold: 40000, extra: 12000 }, calculateShipping, (data, set) => {
      set('before-total', won(data.beforeTotal));
      set('after-total', won(data.afterTotal));
      set('before-detail', '상품 ' + won(data.basket) + ' + 배송비 ' + won(data.beforeFee));
      set('after-detail', '상품 ' + won(data.basket + data.extra) + ' + 배송비 ' + won(data.afterFee));
      set('summary', data.difference > 0
        ? '추가 상품을 담으면 총지출이 ' + won(data.difference) + ' 늘어요.'
        : data.difference < 0 ? '추가 상품을 담으면 총지출이 ' + won(-data.difference) + ' 줄어요.'
          : '두 선택의 결제 총액이 같아요.');
      set('condition', data.basket >= data.threshold
        ? '필요한 상품만으로 이미 무료 배송 기준을 충족해요. 두 선택 모두 배송비가 0원이에요.'
        : data.remaining > 0 ? '추가 상품을 담아도 무료 배송 기준까지 ' + won(data.remaining) + ' 부족해요. 배송비가 그대로 붙어요.'
          : '추가 상품을 담으면 무료 배송 기준을 충족해요. 배송비 ' + won(data.beforeFee) + '이 줄어들어요.');
      set('equation', '추가 상품 ' + won(data.extra) + ' − 줄어든 배송비 ' + won(data.beforeFee - data.afterFee)
        + ' = 총액 변화 ' + (data.difference > 0 ? '+' : '') + won(data.difference));
    });

    setupTool('subscription-calculator', [
      { key: 'monthly', label: '한 달 구독료' },
      { key: 'uses', label: '예상 이용 횟수', maximum: MAX_USES },
      { key: 'single', label: '한 번씩 따로 이용할 때의 가격' },
    ], { monthly: 12000, uses: 4, single: 4000 }, calculateSubscription, (data, set) => {
      set('subscription-total', won(data.monthly));
      set('separate-total', won(data.separateTotal));
      set('subscription-detail', data.perUse === null ? '이용 0회: 회당 금액을 계산하지 않아요.'
        : '예상 ' + data.uses.toLocaleString('ko-KR') + '회 이용 시 회당 약 ' + won(data.perUse));
      set('separate-detail', won(data.single) + ' × ' + data.uses.toLocaleString('ko-KR') + '회');
      set('summary', data.uses === 0
        ? '예상 이용이 0회예요. 구독을 유지하면 ' + won(data.monthly) + ', 따로 이용하지 않으면 0원이에요.'
        : data.difference > 0 ? '입력한 횟수만큼 따로 이용하면 구독보다 ' + won(data.difference) + ' 적게 들어요.'
          : data.difference < 0 ? '입력한 횟수만큼 이용하면 구독이 따로 이용하기보다 ' + won(-data.difference) + ' 적게 들어요.'
            : '입력한 횟수에서는 구독과 따로 이용하는 비용이 같아요.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTools);
  else initTools();
})();
