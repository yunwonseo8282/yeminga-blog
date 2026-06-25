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
const SITEMAP_XML = path.join(ROOT, "sitemap.xml");

const SITE_ORIGIN = "https://yeminga.com";

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

/* --------------------------------------------------------
   getRelatedPosts(currentPost, allPosts, max)
   - 기준 글을 제외한 후보를 3단계 우선순위로 정렬해 최대 max개 반환
   - 1순위: 공유 태그 수 (많을수록 위)
   - 2순위: 같은 카테고리 여부
   - 3순위: 발행일 최신순
   - 0개이면 빈 배열 반환
-------------------------------------------------------- */
function getRelatedPosts(currentPost, allPosts, max = 4) {
  const others = allPosts.filter((p) => p.url !== currentPost.url);
  if (others.length === 0) return [];

  const currentTags = Array.isArray(currentPost.tags) ? currentPost.tags : [];

  const scored = others.map((p) => {
    const pTags = Array.isArray(p.tags) ? p.tags : [];
    const sharedTags = currentTags.filter((t) => pTags.includes(t)).length;
    const sameCategory = p.category === currentPost.category ? 1 : 0;
    return { post: p, sharedTags, sameCategory };
  });

  scored.sort((a, b) => {
    if (b.sharedTags !== a.sharedTags) return b.sharedTags - a.sharedTags;
    if (b.sameCategory !== a.sameCategory) return b.sameCategory - a.sameCategory;
    return String(b.post.date).localeCompare(String(a.post.date));
  });

  return scored.slice(0, max).map((s) => s.post);
}

/* 관련 글 카드 1개 HTML */
function createRelatedCardHtml(post) {
  const cat = CATEGORY_MAP[post.category] || {
    label: "심리",
    badge: "badge--emotion",
  };

  const thumb = post.thumbnail
    ? `<img class="thumb" src="${escapeHtml(post.thumbnail)}" alt="${escapeHtml(
        post.title
      )} 썸네일" loading="lazy" />`
    : `<div class="thumb" aria-hidden="true"></div>`;

  return `          <a class="related-card" href="${escapeHtml(post.url)}">
            ${thumb}
            <div class="related-card-body">
              <span class="badge ${cat.badge}">${escapeHtml(cat.label)}</span>
              <p class="related-card-title">${escapeHtml(post.title)}</p>
            </div>
          </a>`;
}

/* 관련 글 섹션 전체 HTML (후보 0개면 빈 문자열 반환) */
function createRelatedSectionHtml(currentPost, allPosts) {
  const related = getRelatedPosts(currentPost, allPosts);
  if (related.length === 0) return "";

  const cardsHtml = related.map(createRelatedCardHtml).join("\n");

  return `        <section class="related-posts" aria-label="이런 글도 있어요">
          <h2 class="related-posts-title">📚 이런 글도 있어요</h2>
          <div class="related-grid">
${cardsHtml}
          </div>
        </section>`;
}

/* --------------------------------------------------------
   buildRelatedPosts(posts)
   - 각 글 HTML의 RELATED_START ~ RELATED_END 마커를
     관련 글 섹션으로 교체합니다.
   - 마커가 없는 파일은 경고만 출력하고 건너뜁니다.
-------------------------------------------------------- */
function buildRelatedPosts(posts) {
  const POSTS_DIR = path.join(ROOT, "posts");
  const markerRe = /<!-- RELATED_START -->[\s\S]*?<!-- RELATED_END -->/;
  const backLinkAnchor = '        <a class="back-link"';
  let updated = 0;

  for (const post of posts) {
    const fileName = path.basename(post.url); // "slug.html"
    const filePath = path.join(POSTS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`[build] 경고: ${filePath} 파일을 찾을 수 없습니다.`);
      continue;
    }

    let html = fs.readFileSync(filePath, "utf8");
    const sectionHtml = createRelatedSectionHtml(post, posts);

    if (markerRe.test(html)) {
      /* ── 마커 있음: 마커 사이를 교체 ── */
      const replacement = sectionHtml
        ? `<!-- RELATED_START -->\n${sectionHtml}\n        <!-- RELATED_END -->`
        : `<!-- RELATED_START --><!-- RELATED_END -->`;
      html = html.replace(markerRe, replacement);

    } else {
      /* ── 마커 없음: 중복 확인 후 back-link 앞에 삽입 ── */

      // 이미 섹션이 존재하면(중복 방지) 건너뜀
      if (html.includes('class="related-posts"')) {
        console.warn(`[build] 경고: ${fileName} 에 마커 없이 관련 글 섹션이 이미 존재합니다. 건너뜁니다.`);
        continue;
      }

      // 후보 0개면 삽입 안 함
      if (!sectionHtml) continue;

      // back-link 앵커를 찾아 그 앞에 섹션+마커를 삽입
      if (!html.includes(backLinkAnchor)) {
        console.warn(`[build] 경고: ${fileName} 에서 back-link 앵커를 찾지 못했습니다. 건너뜁니다.`);
        continue;
      }

      const wrapped =
        `        <!-- RELATED_START -->\n` +
        `${sectionHtml}\n` +
        `        <!-- RELATED_END -->\n`;
      html = html.replace(backLinkAnchor, wrapped + backLinkAnchor);
    }

    fs.writeFileSync(filePath, html, "utf8");
    updated++;
  }

  console.log(`[build] 관련 글 섹션 완료: ${updated}개 글 HTML 업데이트`);
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

/* --------------------------------------------------------
   buildSitemap(posts)
   - 고정 페이지(메인/about/privacy) + posts.json 글 목록으로
     sitemap.xml 을 자동 생성합니다.
   - node build.js 실행 시 index.html 카드 생성과 함께 호출됩니다.
-------------------------------------------------------- */
function buildSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  /* 고정 페이지 정의 */
  const staticPages = [
    { loc: "/",            lastmod: today, changefreq: "daily",   priority: "1.0" },
    { loc: "/about.html",  lastmod: today, changefreq: "monthly", priority: "0.6" },
    { loc: "/privacy.html",lastmod: today, changefreq: "yearly",  priority: "0.3" },
    { loc: "/terms.html",  lastmod: today, changefreq: "yearly",  priority: "0.3" },
  ];

  /* 글 페이지: posts.json의 url 필드 사용, 발행일 기준 lastmod */
  const postPages = posts.map((p) => ({
    loc: p.url,
    lastmod: p.date || today,
    changefreq: "monthly",
    priority: "0.8",
  }));

  const allPages = [...staticPages, ...postPages];

  const urlEntries = allPages
    .map(
      (p) =>
        `  <url>\n` +
        `    <loc>${SITE_ORIGIN}${p.loc}</loc>\n` +
        `    <lastmod>${p.lastmod}</lastmod>\n` +
        `    <changefreq>${p.changefreq}</changefreq>\n` +
        `    <priority>${p.priority}</priority>\n` +
        `  </url>`
    )
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- 이 파일은 build.js가 자동으로 생성합니다. 직접 수정하지 마세요. -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urlEntries +
    `\n</urlset>\n`;

  fs.writeFileSync(SITEMAP_XML, xml, "utf8");
  console.log(`[build] sitemap.xml 생성 완료 (총 ${allPages.length}개 URL)`);
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
  console.log(`[build] index.html 완료: 글 ${posts.length}개의 카드를 정적으로 생성했습니다.`);

  // 5) 각 글 HTML에 관련 글 섹션 삽입
  buildRelatedPosts(posts);

  // 6) sitemap.xml 자동 생성
  buildSitemap(posts);
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
