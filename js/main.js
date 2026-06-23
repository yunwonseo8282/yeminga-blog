/* =========================================================
   예밍이네 심리사전 - 메인 스크립트
   - posts 배열을 읽어 메인 페이지에 카드를 자동 생성합니다.
   - 새 글을 추가하려면 아래 posts 배열 맨 위에 항목 1개만 추가하세요.
========================================================= */

/* ---------------------------------------------------------
   글 목록 데이터
   새 글 추가 방법:
   1) /posts/ 폴더에 HTML 파일을 추가합니다. (sample-post.html 복사)
   2) 아래 배열 맨 위에 글 정보 객체를 하나 추가합니다.

   category 값은 반드시 다음 중 하나로 적어주세요:
   - "consume"   → 소비 심리
   - "emotion"   → 감정과 자아
   - "relation"  → 인간관계 심리
--------------------------------------------------------- */
const posts = [
  {
    title: "예시 글: 나는 왜 세일만 하면 지갑을 열까?",
    excerpt:
      "할인 앞에서 마음이 흔들리는 이유를 예밍과 함께 가볍게 들여다보는 예시 글입니다.",
    category: "consume",
    date: "2026-06-23",
    thumbnail: "", // 비워두면 파스텔 그라데이션 썸네일이 표시됩니다.
    url: "posts/sample-post.html",
  },
];

/* 카테고리 코드 → 한글 라벨 / 배지 클래스 매핑 */
const CATEGORY_MAP = {
  consume: { label: "소비 심리", badge: "badge--consume" },
  emotion: { label: "감정과 자아", badge: "badge--emotion" },
  relation: { label: "인간관계 심리", badge: "badge--relation" },
};

/* 문자열을 안전하게 HTML에 넣기 위한 이스케이프 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* 날짜를 YYYY.MM.DD 형태로 표시 */
function formatDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${y}.${m}.${d}`;
}

/* 글 1개 → 카드 HTML 문자열 생성 */
function createCardHtml(post) {
  const cat = CATEGORY_MAP[post.category] || {
    label: "심리",
    badge: "badge--emotion",
  };

  const thumb = post.thumbnail
    ? `<img class="thumb" src="${escapeHtml(post.thumbnail)}" alt="${escapeHtml(
        post.title
      )} 썸네일" loading="lazy" />`
    : `<div class="thumb" aria-hidden="true"></div>`;

  return `
    <a class="post-card" href="${escapeHtml(post.url)}" data-category="${escapeHtml(
    post.category
  )}">
      ${thumb}
      <div class="card-body">
        <span class="badge ${cat.badge}">${escapeHtml(cat.label)}</span>
        <h2 class="card-title">${escapeHtml(post.title)}</h2>
        <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
        <div class="card-meta">
          <span>예밍이네 심리사전</span>
          <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
        </div>
      </div>
    </a>
  `;
}

/* 글 목록을 그리드에 렌더링 (filter: 카테고리 코드 또는 "all") */
function renderPosts(filter = "all") {
  const grid = document.getElementById("post-grid");
  if (!grid) return;

  const list =
    filter === "all" ? posts : posts.filter((p) => p.category === filter);

  if (list.length === 0) {
    grid.innerHTML =
      '<p class="empty-state">아직 이 카테고리에 글이 없어요. 곧 채워질 예정이에요!</p>';
    return;
  }

  grid.innerHTML = list.map(createCardHtml).join("");
}

/* 카테고리 필터 버튼 동작 연결 */
function initFilters() {
  const buttons = document.querySelectorAll(".filter-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderPosts(btn.dataset.filter);
    });
  });
}

/* 푸터 연도 자동 갱신 */
function initFooterYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", () => {
  renderPosts("all");
  initFilters();
  initFooterYear();
});
