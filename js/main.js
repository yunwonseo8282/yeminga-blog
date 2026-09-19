/* =========================================================
   예밍이네 심리사전 - 메인 스크립트
   ---------------------------------------------------------
   ⚠️ 글 카드는 build.js가 posts/posts.json을 읽어
   목록/카테고리 HTML 페이지에 "정적으로" 박아넣습니다.

   이 스크립트가 하는 일:
   1) 현재 URL 경로에 맞는 카테고리 필터 링크 활성화
   2) 푸터 연도 자동 갱신
========================================================= */

/* 현재 URL 경로로 필터 링크 is-active 표시 */
function initActiveFilter() {
  const links = document.querySelectorAll(".filter-btn");
  if (!links.length) return;

  let active = "all";
  const match = location.pathname.match(/\/category\/(consume|emotion|relation)(?:\/|$)/);
  if (match) active = match[1];

  links.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.filter === active);
  });
}

/* 푸터 연도 자동 갱신 */
function initFooterYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
}

/* JavaScript가 없으면 메뉴를 펼쳐 둡니다. 작은 화면에서만 접습니다. */
function initMobileMenu() {
  const button = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-navigation');
  if (!button || !nav) return;
  const mobile = window.matchMedia('(max-width: 768px)');
  const setOpen = (open) => {
    nav.hidden = mobile.matches && !open;
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? '메뉴 닫기' : '메뉴 열기';
  };
  const adapt = () => {
    button.hidden = !mobile.matches;
    setOpen(!mobile.matches);
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobile.matches) {
      setOpen(false);
      button.focus();
    }
  });
  mobile.addEventListener('change', adapt);
  adapt();
}

document.addEventListener("DOMContentLoaded", () => {
  initActiveFilter();
  initFooterYear();
  initMobileMenu();
});
