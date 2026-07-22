/* =========================================================
   예밍이네 심리사전 - 정적 빌드 스크립트 (SSG)
   ---------------------------------------------------------
   하는 일:
   - posts/posts.json 의 글 메타데이터를 읽습니다.
   - 최신 발행일순으로 정렬합니다.
   - 글 카드 HTML을 "정적으로" 생성합니다. (런타임 fetch/렌더링 없음)
   - index.html 의 <!-- POSTS_START --> ~ <!-- POSTS_END --> 사이를
     생성한 카드 HTML로 갈아끼웁니다. (그 외 영역은 건드리지 않음)
   - 모든 HTML의 <!-- HEAD_ADSENSE_START --> ~ <!-- HEAD_ADSENSE_END --> 사이에
     구글 애드센스 스크립트를 일괄 주입합니다.

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
const PAGE_SIZE = 12;

const DEFAULT_PAGE_TITLE =
  "예밍이네 심리사전 | 소비·감정·인간관계 심리 이야기";
const DEFAULT_PAGE_DESC =
  "복잡한 마음, 예밍이랑 쉽게 풀어봐요. 소비, 감정, 인간관계 속 작은 심리들을 쉽고 다정하게 풀어내는 공간이에요.";

const POSTS_MARKER = /<!-- POSTS_START -->[\s\S]*?<!-- POSTS_END -->/;
const PAGINATION_MARKER = /<!-- PAGINATION_START -->[\s\S]*?<!-- PAGINATION_END -->/;

/* 구글 애드센스 — HEAD_ADSENSE 마커 사이에 빌드 시 주입 */
const ADSENSE_SCRIPT =
  '  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4067927801872250" crossorigin="anonymous"></script>';
const HEAD_ADSENSE_MARKER = /<!-- HEAD_ADSENSE_START -->[\s\S]*?<!-- HEAD_ADSENSE_END -->/;

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

/* items를 size 단위로 잘라 페이지 배열로 반환 */
function paginate(items, size) {
  if (items.length === 0) return [[]];
  const pages = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

/* 페이지네이션 내비 HTML */
function createPaginationHtml({
  currentPage,
  totalPages,
  getPageHref,
  prevHref,
  nextHref,
}) {
  if (totalPages <= 1) return "";

  const parts = ['        <nav class="pagination" aria-label="페이지 내비게이션">'];

  if (prevHref) {
    parts.push(
      `          <a class="page-prev" href="${escapeHtml(prevHref)}" rel="prev">← 이전</a>`
    );
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      parts.push(`          <span class="page-current" aria-current="page">${i}</span>`);
    } else {
      parts.push(`          <a href="${escapeHtml(getPageHref(i))}">${i}</a>`);
    }
  }

  if (nextHref) {
    parts.push(
      `          <a class="page-next" href="${escapeHtml(nextHref)}" rel="next">다음 →</a>`
    );
  }

  parts.push("        </nav>");
  return parts.join("\n");
}

/* index.html 템플릿 기반 목록/카테고리 페이지 생성 */
function renderListPage({
  template,
  cards,
  outPath,
  canonicalPath,
  pageTitle,
  pageDesc,
  prevHref,
  nextHref,
  currentPage,
  totalPages,
  getPageHref,
}) {
  let html = template;
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(pageTitle)}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtml(pageDesc)}" />`
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${canonicalUrl}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${escapeHtml(pageDesc)}" />`
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${canonicalUrl}" />`
  );

  if (!POSTS_MARKER.test(html)) {
    console.error(
      "[build] 오류: index.html 에서 <!-- POSTS_START --> ~ <!-- POSTS_END --> 마커를 찾지 못했습니다."
    );
    process.exit(1);
  }

  html = html.replace(
    POSTS_MARKER,
    `<!-- POSTS_START -->\n${cards}\n          <!-- POSTS_END -->`
  );

  const paginationHtml = createPaginationHtml({
    currentPage,
    totalPages,
    getPageHref,
    prevHref,
    nextHref,
  });

  if (!PAGINATION_MARKER.test(html)) {
    console.warn(
      `[build] 경고: ${path.relative(ROOT, outPath)} 에서 PAGINATION 마커를 찾지 못했습니다.`
    );
  } else {
    const paginationReplacement = paginationHtml
      ? `<!-- PAGINATION_START -->\n${paginationHtml}\n        <!-- PAGINATION_END -->`
      : `<!-- PAGINATION_START --><!-- PAGINATION_END -->`;
    html = html.replace(PAGINATION_MARKER, paginationReplacement);
  }

  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outPath, html, "utf8");
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

  /* 목록 페이지네이션 URL (/page/2.html …) */
  const listPaginationPages = [];
  const allPageCount = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  for (let n = 2; n <= allPageCount; n++) {
    listPaginationPages.push({
      loc: `/page/${n}.html`,
      lastmod: today,
      changefreq: "daily",
      priority: "0.5",
    });
  }

  /* 카테고리 목록 페이지 URL */
  const categoryPaginationPages = [];
  for (const cat of Object.keys(CATEGORY_MAP)) {
    const catPosts = posts.filter((p) => p.category === cat);
    if (catPosts.length === 0) continue;

    categoryPaginationPages.push({
      loc: `/category/${cat}/`,
      lastmod: today,
      changefreq: "weekly",
      priority: "0.7",
    });

    const catPageCount = Math.ceil(catPosts.length / PAGE_SIZE);
    for (let n = 2; n <= catPageCount; n++) {
      categoryPaginationPages.push({
        loc: `/category/${cat}/page/${n}.html`,
        lastmod: today,
        changefreq: "weekly",
        priority: "0.5",
      });
    }
  }

  const seen = new Set();
  const allPages = [];
  for (const p of [
    ...staticPages,
    ...postPages,
    ...listPaginationPages,
    ...categoryPaginationPages,
  ]) {
    if (seen.has(p.loc)) continue;
    seen.add(p.loc);
    allPages.push(p);
  }

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

/* --------------------------------------------------------
   buildHeadAdsense()
   - 모든 HTML 파일의 HEAD_ADSENSE_START ~ END 마커 사이에
     구글 애드센스 스크립트를 일괄 주입합니다.
   - 마커가 없는 파일은 경고 후 건너뜁니다.
   - 재실행해도 스크립트가 중복 삽입되지 않습니다.
-------------------------------------------------------- */
function collectHtmlFilesRecursive(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFilesRecursive(full));
    } else if (entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

function buildHeadAdsense() {
  const htmlFiles = [
    INDEX_HTML,
    path.join(ROOT, "about.html"),
    path.join(ROOT, "privacy.html"),
    path.join(ROOT, "terms.html"),
    ...collectHtmlFilesRecursive(path.join(ROOT, "page")),
    ...collectHtmlFilesRecursive(path.join(ROOT, "category")),
    ...fs
      .readdirSync(path.join(ROOT, "posts"))
      .filter((f) => f.endsWith(".html"))
      .map((f) => path.join(ROOT, "posts", f)),
  ];

  let updated = 0;
  let skipped = 0;

  for (const filePath of htmlFiles) {
    if (!fs.existsSync(filePath)) {
      console.warn(`[build] 경고: ${filePath} 파일을 찾을 수 없습니다.`);
      skipped++;
      continue;
    }

    let html = fs.readFileSync(filePath, "utf8");

    if (!HEAD_ADSENSE_MARKER.test(html)) {
      console.warn(
        `[build] 경고: ${path.relative(ROOT, filePath)} 에서 HEAD_ADSENSE 마커를 찾지 못했습니다.`
      );
      skipped++;
      continue;
    }

    const replacement =
      `<!-- HEAD_ADSENSE_START -->\n${ADSENSE_SCRIPT}\n  <!-- HEAD_ADSENSE_END -->`;
    html = html.replace(HEAD_ADSENSE_MARKER, replacement);
    fs.writeFileSync(filePath, html, "utf8");
    updated++;
  }

  console.log(`[build] 애드센스 head 주입 완료: ${updated}개 (마커 없음 ${skipped}개)`);
}

function buildListPages(template, posts) {
  const emptyCards =
    '          <p class="empty-state">아직 등록된 글이 없어요. 곧 채워질 예정이에요!</p>';
  let generated = 0;

  const allPages = paginate(posts, PAGE_SIZE);
  const totalAllPages = allPages.length;

  allPages.forEach((pagePosts, idx) => {
    const pageNum = idx + 1;
    const cardsHtml =
      pagePosts.length > 0 ? pagePosts.map(createCardHtml).join("\n") : emptyCards;
    const outPath =
      pageNum === 1 ? INDEX_HTML : path.join(ROOT, "page", `${pageNum}.html`);
    const canonicalPath = pageNum === 1 ? "/" : `/page/${pageNum}.html`;
    const pageTitle =
      pageNum === 1 ? DEFAULT_PAGE_TITLE : `예밍이네 심리사전 (${pageNum}페이지)`;
    const prevHref =
      pageNum > 1 ? (pageNum === 2 ? "/" : `/page/${pageNum - 1}.html`) : null;
    const nextHref =
      pageNum < totalAllPages ? `/page/${pageNum + 1}.html` : null;

    renderListPage({
      template,
      cards: cardsHtml,
      outPath,
      canonicalPath,
      pageTitle,
      pageDesc: DEFAULT_PAGE_DESC,
      prevHref,
      nextHref,
      currentPage: pageNum,
      totalPages: totalAllPages,
      getPageHref: (n) => (n === 1 ? "/" : `/page/${n}.html`),
    });
    generated++;
  });

  for (const cat of Object.keys(CATEGORY_MAP)) {
    const catPosts = posts.filter((p) => p.category === cat);
    if (catPosts.length === 0) continue;

    const catPages = paginate(catPosts, PAGE_SIZE);
    const totalCatPages = catPages.length;
    const label = CATEGORY_MAP[cat].label;

    catPages.forEach((pagePosts, idx) => {
      const pageNum = idx + 1;
      const cardsHtml = pagePosts.map(createCardHtml).join("\n");
      const outPath =
        pageNum === 1
          ? path.join(ROOT, "category", cat, "index.html")
          : path.join(ROOT, "category", cat, "page", `${pageNum}.html`);
      const canonicalPath =
        pageNum === 1 ? `/category/${cat}/` : `/category/${cat}/page/${pageNum}.html`;
      let pageTitle = `${label} | 예밍이네 심리사전`;
      if (pageNum >= 2) pageTitle += ` (${pageNum}페이지)`;
      const pageDesc = `${label} 카테고리 글 모음. ${DEFAULT_PAGE_DESC}`;
      const prevHref =
        pageNum > 1
          ? pageNum === 2
            ? `/category/${cat}/`
            : `/category/${cat}/page/${pageNum - 1}.html`
          : null;
      const nextHref =
        pageNum < totalCatPages ? `/category/${cat}/page/${pageNum + 1}.html` : null;

      renderListPage({
        template,
        cards: cardsHtml,
        outPath,
        canonicalPath,
        pageTitle,
        pageDesc,
        prevHref,
        nextHref,
        currentPage: pageNum,
        totalPages: totalCatPages,
        getPageHref: (n) =>
          n === 1 ? `/category/${cat}/` : `/category/${cat}/page/${n}.html`,
      });
      generated++;
    });
  }

  console.log(
    `[build] 목록/카테고리 페이지 생성 완료: ${generated}개 (전체 ${posts.length}글, PAGE_SIZE ${PAGE_SIZE})`
  );
}

function build() {
  // 1) 데이터 읽기
  const raw = fs.readFileSync(POSTS_JSON, "utf8");
  const posts = JSON.parse(raw);

  // 2) 최신 발행일순 정렬 (내림차순)
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // 3) index.html 템플릿 읽기 → 목록/카테고리 페이지 생성
  const template = fs.readFileSync(INDEX_HTML, "utf8");
  if (!POSTS_MARKER.test(template)) {
    console.error(
      "[build] 오류: index.html 에서 <!-- POSTS_START --> ~ <!-- POSTS_END --> 마커를 찾지 못했습니다."
    );
    process.exit(1);
  }
  buildListPages(template, posts);

  // 4) 각 글 HTML에 관련 글 섹션 삽입
  buildRelatedPosts(posts);

  // 5) sitemap.xml 자동 생성
  buildSitemap(posts);

  // 6) 모든 HTML에 애드센스 스크립트 주입
  buildHeadAdsense();
}

build();

/* ---------------------------------------------------------
   새 글 추가 워크플로우
   1) posts/sample-post.html 을 복사해 posts/ 에 새 글 HTML 작성
      (head에 <!-- HEAD_ADSENSE_START --><!-- HEAD_ADSENSE_END --> 마커 포함)
   2) posts/posts.json 에 항목 1개 추가 (title, excerpt, category,
      date, thumbnail, url). category 는 consume | emotion | relation
   3) node build.js 실행 → 목록/카테고리 페이지 + 관련 글 + 애드센스 head 주입
   4) git add . && git commit && git push → Cloudflare Pages 자동 배포
--------------------------------------------------------- */
