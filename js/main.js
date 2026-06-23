/* =========================================================
   예밍이네 심리사전 - 메인 스크립트 (필터 전용)
   ---------------------------------------------------------
   ⚠️ 글 카드는 더 이상 JS로 생성하지 않습니다.
   카드는 build.js가 posts/posts.json을 읽어 index.html에
   "정적으로" 박아넣습니다. (node build.js)

   이 스크립트가 하는 일은 두 가지뿐입니다:
   1) 카테고리 필터 버튼 클릭 시, 이미 HTML에 존재하는 카드의
      display 만 토글(show/hide)합니다.
      → JavaScript를 꺼도 모든 카드는 HTML에 그대로 남아 있습니다.
   2) 푸터 연도 자동 갱신.
========================================================= */

/* 카테고리 필터: 카드 show/hide 토글 (카드 생성 X) */
function initFilters() {
  const buttons = document.querySelectorAll(".filter-btn");
  const cards = document.querySelectorAll(".post-card");
  if (!buttons.length || !cards.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const filter = btn.dataset.filter;
      cards.forEach((card) => {
        const show = filter === "all" || card.dataset.category === filter;
        // 빈 문자열로 되돌리면 CSS 기본 display(그리드 아이템)로 복귀
        card.style.display = show ? "" : "none";
      });
    });
  });
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
