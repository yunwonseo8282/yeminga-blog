/* =========================================================
   예밍이네 심리사전 - 메인 스크립트 (필터 전용)
   ---------------------------------------------------------
   ⚠️ 글 카드는 더 이상 JS로 생성하지 않습니다.
   카드는 build.js가 posts/posts.json을 읽어 index.html에
   "정적으로" 박아넣습니다. (node build.js)

   이 스크립트가 하는 일:
   1) 카테고리 필터 버튼 클릭 → 카드 show/hide 토글
   2) 헤더 메뉴 클릭(해시 변경) → 동일한 필터 적용 + 버튼 활성화 동기화
   3) 페이지 로드 시 URL 해시 읽어 초기 필터 적용
   4) 푸터 연도 자동 갱신
========================================================= */

/* 유효한 카테고리 해시 목록 */
const HASH_TO_FILTER = {
  "#consume": "consume",
  "#emotion": "emotion",
  "#relation": "relation",
};

/* --------------------------------------------------------
   applyFilter(filter)
   - filter: "all" | "consume" | "emotion" | "relation"
   - 카드 show/hide + 버튼 is-active 상태를 한 번에 처리.
   - 버튼 클릭과 해시 변경 모두 이 함수 하나로 처리.
-------------------------------------------------------- */
function applyFilter(filter) {
  const buttons = document.querySelectorAll(".filter-btn");
  const cards = document.querySelectorAll(".post-card");

  /* 버튼 활성화 상태 동기화 */
  buttons.forEach((btn) => {
    const matches = btn.dataset.filter === filter;
    btn.classList.toggle("is-active", matches);
  });

  /* 카드 show/hide */
  cards.forEach((card) => {
    const show = filter === "all" || card.dataset.category === filter;
    card.style.display = show ? "" : "none";
  });
}

/* --------------------------------------------------------
   현재 URL 해시로부터 filter 값을 반환.
   인식하지 못하는 해시이거나 해시 없으면 "all" 반환.
-------------------------------------------------------- */
function filterFromHash() {
  return HASH_TO_FILTER[location.hash] ?? "all";
}

/* --------------------------------------------------------
   initFilters()
   - 본문 필터 버튼 클릭: applyFilter 호출 (기존 동작 그대로)
   - hashchange 이벤트: 헤더 메뉴 클릭 시 해시 바뀌면 applyFilter 호출
   - 페이지 최초 로드: 해시 읽어 초기 필터 적용
-------------------------------------------------------- */
function initFilters() {
  const buttons = document.querySelectorAll(".filter-btn");
  const cards = document.querySelectorAll(".post-card");
  if (!buttons.length || !cards.length) return;

  /* 본문 필터 버튼 클릭 — 기존 동작 그대로 유지 */
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyFilter(btn.dataset.filter);
    });
  });

  /* 헤더 메뉴 클릭 시 발생하는 hashchange 대응 */
  window.addEventListener("hashchange", () => {
    applyFilter(filterFromHash());
  });

  /* 페이지 최초 로드: 해시가 있으면 해당 카테고리, 없으면 전체 */
  applyFilter(filterFromHash());
}

/* 푸터 연도 자동 갱신 */
function initFooterYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", () => {
  initFilters();
  initFooterYear();
});
