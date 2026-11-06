/* node scripts/test-validate-faq.js — 실제 검증 CLI의 FAQ 누락·중복 회귀 검사. 외부 요청 없음. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// 선택 인수는 수정 전/후 validator를 같은 fixture로 비교할 때만 사용합니다.
const validator = path.resolve(process.argv[2] || path.join(__dirname, 'validate.js'));
const validatorSource = fs.readFileSync(validator, 'utf8');
const tempParent = path.resolve(os.tmpdir());
const fixtureRoot = fs.mkdtempSync(path.join(tempParent, 'yeminga-faq-validator-'));
const post = {
  title: 'FAQ fixture', excerpt: 'Fixture description', category: 'emotion',
  date: '2000-01-01', thumbnail: '/images/fixture.svg', url: '/posts/faq-fixture.html',
};
const article = {
  '@type': 'Article', headline: post.title, dateModified: post.date,
  author: { url: 'https://yeminga.com/about#operator' },
};
const schema = {
  '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Question?',
    acceptedAnswer: { '@type': 'Answer', text: 'A clear answer.' } }],
};
const visible = '<div class="faq-item"><h3>Question?</h3><p>A <strong>clear</strong> answer.</p></div>';
const menu = '<nav id="main-navigation"></nav><button class="menu-toggle">Menu</button>';
const page = (body) => '<!doctype html><html><body>' + menu + body + '</body></html>';
const block = (value) => '<script type="application/ld+json">' + JSON.stringify(value) + '</script>';
const cardinalityError = post.url + ': 화면 FAQ가 있으면 FAQPage는 정확히 하나여야 합니다';
const mismatchError = post.url + ': 화면과 FAQ 구조화 데이터 불일치';
const cases = [
  { name: 'matching graph', blocks: [{ '@graph': [article, schema] }], visible, error: null },
  { name: 'missing FAQPage', blocks: [{ '@graph': [article] }], visible, error: cardinalityError },
  { name: 'duplicate in graph', blocks: [{ '@graph': [article, schema, schema] }], visible, error: cardinalityError },
  { name: 'no visible FAQ and no FAQPage', blocks: [{ '@graph': [article] }], visible: '', error: null },
  { name: 'mismatched answer', blocks: [{ '@graph': [article, {
    ...schema, mainEntity: [{ ...schema.mainEntity[0], acceptedAnswer: { '@type': 'Answer', text: 'Wrong answer.' } }],
  }] }], visible, error: mismatchError },
  { name: 'malformed mainEntity', blocks: [{ '@graph': [article, { ...schema, mainEntity: {} }] }], visible, error: mismatchError },
  { name: 'matching standalone scripts', blocks: [article, schema], visible, error: null },
  { name: 'duplicate across scripts', blocks: [{ '@graph': [article, schema] }, schema], visible, error: cardinalityError },
];
const results = [];
function write(relative, content) {
  const target = path.join(fixtureRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
try {
  write('scripts/validate.js', validatorSource);
  write('posts/posts.json', JSON.stringify([post]));
  write('images/fixture.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
  write('index.html', page('<h1>Fixture list</h1><!-- FEATURED_START --><!-- FEATURED_END -->' +
    '<!-- POSTS_START --><a class="post-card" href="/posts/faq-fixture">Fixture</a><!-- POSTS_END -->'));
  for (const file of ['404.html', 'privacy.html', 'terms.html', 'about.html']) {
    write(file, page('<h1>Fixture page</h1><div id="operator"></div>'));
  }
  write('robots.txt', 'User-agent: *\nAllow: /\n');
  write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    '<url><loc>https://yeminga.com/posts/faq-fixture</loc></url></urlset>');
  for (const test of cases) {
    write('posts/faq-fixture.html', page('<h1>' + post.title + '</h1>' +
      '<meta name="description" content="' + post.excerpt + '" />' +
      '<meta property="og:image" content="https://yeminga.com' + post.thumbnail + '" />' +
      '<link rel="canonical" href="https://yeminga.com/posts/faq-fixture" />' +
      '<img src="' + post.thumbnail + '" alt="Fixture" />' + test.blocks.map(block).join('\n') + test.visible));
    const child = spawnSync(process.execPath, [path.join(fixtureRoot, 'scripts/validate.js')], {
      encoding: 'utf8', timeout: 10000, windowsHide: true,
    });
    let failure = null;
    try {
      assert.ifError(child.error);
      assert.equal(child.signal, null);
      assert.equal(child.status, test.error ? 1 : 0, 'unexpected CLI exit status');
      assert.equal(child.stderr.trim(), test.error || '', 'unexpected or unrelated validation diagnostic');
      if (!test.error) assert.match(child.stdout, /검증 통과: 글 1편/);
    } catch (error) { failure = error.message; }
    results.push({ name: test.name, passed: !failure, status: child.status,
      stdout: child.stdout, stderr: child.stderr, ...(failure ? { failure } : {}) });
  }
} finally {
  // mkdtemp로 만든 경로만 정리합니다. 예상 부모/접두사 밖의 경로는 삭제하지 않습니다.
  const resolved = path.resolve(fixtureRoot);
  if (path.dirname(resolved) !== tempParent || !path.basename(resolved).startsWith('yeminga-faq-validator-')) {
    throw new Error('Unexpected fixture cleanup target: ' + resolved);
  }
  fs.rmSync(resolved, { recursive: true, force: false });
}
const passed = results.filter((result) => result.passed).length;
console.log(JSON.stringify({ validator, cases: results.length, passed, failed: results.length - passed, results }, null, 2));
if (passed !== results.length) process.exitCode = 1;
