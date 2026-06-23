# 예밍이네 심리사전

순수 HTML/CSS/JavaScript로 만든 정적 블로그입니다. 프레임워크 없이, 글 목록은 가벼운 Node.js 빌드 스크립트(`build.js`)로 **정적 생성(SSG)** 합니다. 결과물은 그대로 Cloudflare Pages에 배포됩니다.

- 사이트 이름: 예밍이네 심리사전
- 배포 도메인(예정): https://yeminga.com
- 카테고리: 소비 심리 / 감정과 자아 / 인간관계 심리

> **왜 SSG인가?** 글 목록을 JS로 런타임 렌더링하면 JavaScript를 끈 검색/광고 봇이 콘텐츠를 못 읽습니다(SEO·애드센스 불리). 그래서 카드 HTML을 `index.html`에 미리 박아두고, JS는 카테고리 필터(show/hide)만 담당합니다.

## 폴더 구조

```text
yeminga-blog/
├── build.js                # 글 목록 정적 생성 스크립트 (node build.js)
├── index.html              # 메인 (카드가 정적으로 박혀 있음)
├── about.html              # 소개 (E-E-A-T)
├── privacy.html            # 개인정보처리방침
├── robots.txt              # 봇 허용 + sitemap 위치
├── sitemap.xml             # 사이트맵
├── ads.txt                 # 애드센스 게시자 ID (승인 후 입력)
├── posts/
│   ├── posts.json          # ★ 글 메타데이터 단일 소스 (제목/요약/카테고리/날짜/썸네일/url)
│   └── sample-post.html    # 글 템플릿 + 예시
├── css/style.css           # 공통 스타일 (CSS 변수 기반)
├── js/main.js              # 카테고리 필터 토글 + 푸터 연도 (카드 생성 X)
└── images/                 # 이미지 (썸네일, og-default.png 등)
```

## 새 글 추가하는 법

1. `posts/sample-post.html`을 복사해 `posts/` 안에 새 이름으로 저장합니다.
   - 예: `posts/why-i-buy-on-sale.html`
2. 파일 안의 `[TODO]` 부분(제목, 설명, 카테고리, 날짜, 본문, JSON-LD)을 채웁니다.
3. `posts/posts.json`에 글 정보를 **항목 1개** 추가합니다. (순서는 상관없음 — 빌드 시 발행일 최신순 자동 정렬)

```json
[
  {
    "title": "새 글 제목",
    "excerpt": "카드에 보일 요약 (최대 3줄까지 표시됩니다)",
    "category": "consume",
    "date": "2026-07-01",
    "thumbnail": "/images/새글-썸네일.png",
    "url": "/posts/새글-파일명.html"
  }
]
```

   - `category`: `consume`(소비 심리) / `emotion`(감정과 자아) / `relation`(인간관계 심리)
   - `thumbnail`: 비우면(`""`) 파스텔 그라데이션 썸네일이 표시됩니다.
   - 경로는 모두 루트 절대경로(`/posts/...`, `/images/...`)로 적습니다.

4. **빌드 실행**: `node build.js`
   → `index.html`의 `<!-- POSTS_START --> ~ <!-- POSTS_END -->` 사이가 카드 HTML로 다시 생성됩니다.
5. **배포**: `git add . && git commit -m "새 글 추가" && git push`
   → Cloudflare Pages가 자동 배포합니다.
6. (선택) `sitemap.xml`에 새 글 `<url>` 블록을 추가하면 SEO에 좋습니다.

## 색상/폰트 바꾸기

`css/style.css` 상단의 `:root` 변수만 수정하면 전체 톤이 바뀝니다.

## 배포 (Cloudflare Pages)

`node build.js`를 **로컬에서 실행해 생성된 `index.html`을 그대로 커밋·푸시**하는 방식이라, Cloudflare에서 별도 빌드 명령이 필요 없습니다.

- 빌드 명령: (없음)
- 출력 디렉터리: `/` (루트)

> 만약 Cloudflare가 빌드 단계에서 직접 생성하게 하고 싶다면, 빌드 명령에 `node build.js`를 넣어도 됩니다. (Node 런타임 필요) 다만 위처럼 로컬 빌드 후 커밋하는 방식이 가장 단순합니다.

## 배포 전 체크리스트

- [ ] `ads.txt`에 애드센스 게시자 ID 입력
- [ ] `about.html` / `privacy.html`의 `[TODO]`, 이메일, 운영자 정보 채우기
- [ ] `images/og-default.png` (기본 공유 이미지) 추가
- [ ] 도메인 연결 후 `robots.txt` / `sitemap.xml` 주소 확인
