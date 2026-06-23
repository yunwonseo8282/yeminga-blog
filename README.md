# 예밍이네 심리사전

순수 HTML/CSS/JavaScript로 만든 정적 블로그입니다. 빌드 도구·프레임워크 없이 그대로 Cloudflare Pages에 배포됩니다.

- 사이트 이름: 예밍이네 심리사전
- 배포 도메인(예정): https://yeminga.com
- 카테고리: 소비 심리 / 감정과 자아 / 인간관계 심리

## 폴더 구조

```text
yeminga-blog/
├── index.html              # 메인 (글 카드 목록)
├── about.html              # 소개 (E-E-A-T)
├── privacy.html            # 개인정보처리방침
├── robots.txt              # 봇 허용 + sitemap 위치
├── sitemap.xml             # 사이트맵
├── ads.txt                 # 애드센스 게시자 ID (승인 후 입력)
├── posts/                  # 개별 글 HTML
│   └── sample-post.html    # 글 템플릿 + 예시
├── css/style.css           # 공통 스타일 (CSS 변수 기반)
├── js/main.js              # 글 목록 데이터 + 카드 렌더링
└── images/                 # 이미지 (썸네일, og-default.png 등)
```

## 새 글 추가하는 법

1. `posts/sample-post.html`을 복사해 `posts/` 안에 새 이름으로 저장합니다.
   - 예: `posts/why-i-buy-on-sale.html`
2. 파일 안의 `[TODO]` 부분(제목, 설명, 카테고리, 날짜, 본문, JSON-LD)을 채웁니다.
3. `js/main.js`의 `posts` 배열 **맨 위**에 글 정보를 한 개 추가합니다.

```js
const posts = [
  {
    title: "새 글 제목",
    excerpt: "한두 문장 요약",
    category: "consume", // consume | emotion | relation
    date: "2026-07-01",
    thumbnail: "images/새글-썸네일.png", // 비우면 기본 그라데이션
    url: "posts/새글-파일명.html",
  },
  // ...기존 글
];
```

4. (선택) `sitemap.xml`에 새 글 `<url>` 블록을 추가하면 SEO에 좋습니다.

## 색상/폰트 바꾸기

`css/style.css` 상단의 `:root` 변수만 수정하면 전체 톤이 바뀝니다.

## 배포 (Cloudflare Pages)

별도 빌드 명령 없이 이 폴더를 그대로 연결하면 됩니다.

- 빌드 명령: (없음)
- 출력 디렉터리: `/` (루트)

## 배포 전 체크리스트

- [ ] `ads.txt`에 애드센스 게시자 ID 입력
- [ ] `about.html` / `privacy.html`의 `[TODO]`, 이메일, 운영자 정보 채우기
- [ ] `images/og-default.png` (기본 공유 이미지) 추가
- [ ] 도메인 연결 후 `robots.txt` / `sitemap.xml` 주소 확인
