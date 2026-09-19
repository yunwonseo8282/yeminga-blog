/* 게시 전 링크, 메타데이터와 정적 생성 결과를 확인합니다. 외부 요청 없음. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'posts/posts.json'), 'utf8'));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const read = (file) => fs.readFileSync(file, 'utf8');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    if (item.name.startsWith('.') || ['node_modules', 'scripts'].includes(item.name)) return [];
    const file = path.join(dir, item.name);
    return item.isDirectory() ? walk(file) : file.endsWith('.html') ? [file] : [];
  });
}
function resolveLocal(url) {
  const pathname = decodeURIComponent(url.pathname);
  const base = path.join(root, pathname);
  if (!base.startsWith(root + path.sep) && base !== root) return null;
  const candidates = pathname.endsWith('/') ? [path.join(base, 'index.html')] : [base, base + '.html', path.join(base, 'index.html')];
  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
}
const documents = new Map(walk(root).map((file) => [file, read(file)]));
let linkCount = 0;
for (const [file, html] of documents) {
  const relative = path.relative(root, file);
  check((html.match(/<h1\b/g) || []).length === 1, relative + ': h1은 하나여야 합니다');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  check(new Set(ids).size === ids.length, relative + ': 중복 id');
  check(html.includes('id="main-navigation"') && html.includes('class="menu-toggle"'), relative + ': 메뉴 누락');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const href = match[1].replace(/&amp;/g, '&');
    if (/^(?:mailto:|tel:|data:|javascript:)/.test(href)) continue;
    let url;
    try { url = new URL(href, 'https://yeminga.com/' + relative.replace(/\\/g, '/')); } catch { errors.push(relative + ': 잘못된 링크 ' + href); continue; }
    if (url.hostname !== 'yeminga.com') continue;
    linkCount++;
    const target = resolveLocal(url);
    check(!!target, relative + ': 연결 대상 없음 ' + href);
    if (target && url.hash && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      check((documents.get(target) || read(target)).includes(`id="${id}"`), relative + ': 문서 내 위치 없음 ' + href);
    }
  }
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(block[1]); } catch { errors.push(relative + ': 잘못된 JSON-LD'); }
  }
}
for (const post of posts) {
  const file = path.join(root, post.url.slice(1));
  const html = documents.get(file);
  if (!html) { errors.push(post.url + ': 본문 없음'); continue; }
  check(text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '') === post.title, post.url + ': 제목 불일치');
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  check(text(desc || '') === post.excerpt, post.url + ': 요약 불일치');
  const shareImage = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  check(shareImage === 'https://yeminga.com' + post.thumbnail, post.url + ': 공유 이미지 불일치');
  check(html.includes(`href="https://yeminga.com${post.url.replace(/\.html$/, '')}"`), post.url + ': canonical 불일치');
  check(!!post.referenceCheckedOn === html.includes('class="ref-checked"'), post.url + ': 자료 확인일 자동 생성 오류');
  const modified = post.dateModified || post.date;
  check(modified >= post.date && modified <= new Date().toISOString().slice(0, 10), post.url + ': 수정일 범위 오류');
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((match) => {
    try { const data = JSON.parse(match[1]); return data['@graph'] || [data]; } catch { return []; }
  });
  const article = scripts.find((item) => ['Article', 'BlogPosting'].includes(item['@type']));
  check(article?.headline === post.title && article?.dateModified === modified, post.url + ': Article 메타데이터 불일치');
  check(article?.author?.url === 'https://yeminga.com/about#operator', post.url + ': 작성자 링크 누락');
  const visibleFaq = [...html.matchAll(/<div class="faq-item">([\s\S]*?)<\/div>/g)].map((match) => ({
    name: text((match[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || ''),
    answer: [...match[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((p) => text(p[1])).join(' '),
  }));
  const schemaFaq = scripts.find((item) => item['@type'] === 'FAQPage');
  if (schemaFaq) {
    try { assert.deepEqual(schemaFaq.mainEntity.map((item) => ({ name: item.name, answer: item.acceptedAnswer.text })), visibleFaq); }
    catch { errors.push(post.url + ': 화면과 FAQ 구조화 데이터 불일치'); }
  }
}
// 전체 목록의 경계에서 글이 반복되거나 누락되지 않아야 합니다.
const byDate = [...posts].sort((a, b) => b.date.localeCompare(a.date));
const listed = [];
for (let page = 1; ; page++) {
  const file = page === 1 ? path.join(root, 'index.html') : path.join(root, 'page', `${page}.html`);
  if (!fs.existsSync(file)) break;
  const html = read(file);
  if (page === 1) {
    const featured = html.match(/<!-- FEATURED_START -->([\s\S]*?)<!-- FEATURED_END -->/);
    const links = [...(featured?.[1] || '').matchAll(/href="(\/posts\/[^"#]+)"/g)].map((m) => m[1]);
    listed.push(...new Set(links));
  }
  const cards = html.match(/<!-- POSTS_START -->([\s\S]*?)<!-- POSTS_END -->/);
  listed.push(...[...(cards?.[1] || '').matchAll(/class="post-card" href="([^"]+)"/g)].map((m) => m[1]));
}
try { assert.deepEqual(listed, byDate.map((p) => p.url.replace(/\.html$/, ''))); }
catch { errors.push('전체 목록 페이지 사이에 중복/누락/순서 오류가 있습니다'); }
for (const file of ['404.html', 'privacy.html', 'terms.html', 'about.html']) {
  check(!read(path.join(root, file)).includes('adsbygoogle.js'), file + ': 안내/오류 페이지에 광고 코드');
}
const sitemap = read(path.join(root, 'sitemap.xml'));
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check(new Set(sitemapUrls).size === sitemapUrls.length, '사이트맵 중복');
for (const url of sitemapUrls) check(!!resolveLocal(new URL(url)), '사이트맵 파일 없음: ' + url);
for (const post of posts) check(sitemapUrls.includes('https://yeminga.com' + post.url.replace(/\.html$/, '')), '사이트맵 글 누락: ' + post.url);
check(/User-agent:\s*\*[\s\S]*Allow:\s*\//.test(read(path.join(root, 'robots.txt'))), 'robots.txt 전체 접근 허용 확인 필요');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`검증 통과: 글 ${posts.length}편, HTML ${documents.size}개, 내부 링크·자산 ${linkCount}개, 목록·구조화 데이터·사이트맵·광고 제외 페이지`);
