/* =========================================================
   예밍이네 심리사전 - 정적 빌드 스크립트 (SSG)
   ---------------------------------------------------------
   하는 일:
   - posts/posts.json 의 글 메타데이터를 읽습니다.
   - 최신 발행일순으로 정렬합니다.
   - 글 카드 HTML을 "정적으로" 생성합니다. (런타임 fetch/렌더링 없음)
   - index.html 의 <!-- POSTS_START --> ~ <!-- POSTS_END --> 사이를
     생성한 카드 HTML로 갈아끼웁니다. (그 외 영역은 건드리지 않음)

   실행: node build.js

   ※ 새 글 추가 워크플로우는 이 파일 하단 주석 또는 README.md 참고.
========================================================= */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const POSTS_JSON = path.join(ROOT, "posts", "posts.json");
const INDEX_HTML = path.join(ROOT, "index.html");

/* 카테고리 코드 → 한글 라벨 / 배지 클래스 매핑 */
const CATEGORY_MAP = {
  consume: { label: "소비 심리", badge: "badge--consume" },
  emotion: { label: "감정과 자아", badge: "badge--emotion" },
  relation: { label: "인간관계 심리", badge: "badge--relation" },
};

/* HTML 특수문자 이스케이프 (속성/텍스트 안전 삽입용) */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* 날짜 YYYY-MM-DD → YYYY.MM.DD 표시용 */
function formatDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = String(isoDate).split("-");
  if (!y || !m || !d) return isoDate;
  return `${y}.${m}.${d}`;
}

/* 글 1개 → 카드 HTML (정적 문자열).
   - data-category 속성을 항상 부여 → JS 없이도 필터 대상 식별 가능
   - 썸네일이 없으면 파스텔 그라데이션 div 사용 */
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

  return `          <a class="post-card" href="${escapeHtml(
    post.url
  )}" data-category="${escapeHtml(post.category)}">
            ${thumb}
            <div class="card-body">
              <span class="badge ${cat.badge}">${escapeHtml(cat.label)}</span>
              <h2 class="card-title">${escapeHtml(post.title)}</h2>
              <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
              <div class="card-meta">
                <span>예밍이네 심리사전</span>
                <time datetime="${escapeHtml(post.date)}">${formatDate(
    post.date
  )}</time>
              </div>
            </div>
          </a>`;
}

function build() {
  // 1) 데이터 읽기
  const raw = fs.readFileSync(POSTS_JSON, "utf8");
  const posts = JSON.parse(raw);

  // 2) 최신 발행일순 정렬 (내림차순)
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // 3) 카드 HTML 생성
  const cardsHtml =
    posts.length > 0
      ? posts.map(createCardHtml).join("\n")
      : '          <p class="empty-state">아직 등록된 글이 없어요. 곧 채워질 예정이에요!</p>';

  // 4) index.html 마커 사이 교체
  let html = fs.readFileSync(INDEX_HTML, "utf8");
  const marker = /<!-- POSTS_START -->[\s\S]*?<!-- POSTS_END -->/;

  if (!marker.test(html)) {
    console.error(
      "[build] 오류: index.html 에서 <!-- POSTS_START --> ~ <!-- POSTS_END --> 마커를 찾지 못했습니다."
    );
    process.exit(1);
  }

  const replacement = `<!-- POSTS_START -->\n${cardsHtml}\n          <!-- POSTS_END -->`;
  html = html.replace(marker, replacement);

  fs.writeFileSync(INDEX_HTML, html, "utf8");
  console.log(`[build] 완료: 글 ${posts.length}개의 카드를 index.html에 정적으로 생성했습니다.`);
}

build();

/* ---------------------------------------------------------
   새 글 추가 워크플로우
   1) posts/sample-post.html 을 복사해 posts/ 에 새 글 HTML 작성
   2) posts/posts.json 에 항목 1개 추가 (title, excerpt, category,
      date, thumbnail, url). category 는 consume | emotion | relation
   3) node build.js 실행 → index.html 카드가 정적으로 다시 생성됨
   4) git add . && git commit && git push → Cloudflare Pages 자동 배포
--------------------------------------------------------- */
