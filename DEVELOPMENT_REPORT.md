# 📖 개역개정 성경 웹앱 — 개발 내역 보고서

> **프로젝트명:** bible-app (개역개정 성경)  
> **작성일:** 2026-03-03  
> **기술 스택:** Node.js · Express · MongoDB Atlas · Vanilla JS · CSS · PWA  
> **배포 환경:** Vercel (Serverless)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [기술 아키텍처](#3-기술-아키텍처)
4. [백엔드 (서버)](#4-백엔드-서버)
5. [프론트엔드 (클라이언트)](#5-프론트엔드-클라이언트)
6. [PWA (Progressive Web App)](#6-pwa-progressive-web-app)
7. [찬송가 기능](#7-찬송가-기능)
8. [설정 패널](#8-설정-패널)
9. [UI/UX 디자인](#9-uiux-디자인)
10. [보안](#10-보안)
11. [배포](#11-배포)
12. [개발 타임라인](#12-개발-타임라인)
13. [데이터베이스 스키마](#13-데이터베이스-스키마)
14. [향후 개선 사항](#14-향후-개선-사항)

---

## 1. 프로젝트 개요

개역개정 한글 성경을 온라인으로 읽고, 구절을 선택하여 공유할 수 있는 **모바일 퍼스트 웹 애플리케이션**입니다. 성경 66권(구약 39권 + 신약 27권)의 전체 본문과 645곡의 찬송가 악보를 제공합니다.

### 핵심 기능
| 기능 | 설명 |
|------|------|
| 📚 **성경 읽기** | 구약/신약 66권, 장/절 단위 탐색 |
| 🎵 **찬송가 악보** | 645곡 악보 이미지 뷰어 (Firebase Storage) |
| 🔗 **구절 공유** | 구절 선택 → 클립보드 복사 / 네이티브 공유 |
| ⚙️ **사용자 설정** | 다크모드, 글자 크기, 글씨체, 굵기, 하단 정렬 |
| 📱 **PWA 지원** | 홈 화면 설치, 오프라인 캐싱 |
| 👆 **스와이프 네비게이션** | 탭 전환 및 장/찬송가 이동을 위한 터치 제스처 |

---

## 2. 프로젝트 구조

```
project4_bible_app/
├── server.js              # Express 서버 (API + 정적 파일 서빙)
├── package.json           # 프로젝트 메타데이터 및 의존성
├── vercel.json            # Vercel 배포 설정
├── .env                   # 환경 변수 (MongoDB URI, Firebase)
├── .gitignore             # Git 제외 파일 (node_modules, .env)
├── icon.png               # 원본 아이콘 이미지
│
└── public/                # 정적 파일 (클라이언트)
    ├── index.html          # 메인 HTML (SPA)
    ├── app.js              # 클라이언트 JavaScript (964줄)
    ├── style.css           # 스타일시트 (1,086줄)
    ├── service-worker.js   # PWA 서비스 워커
    ├── manifest.json       # PWA 매니페스트
    └── icons/              # PWA 아이콘 (8종)
        ├── icon-72.png
        ├── icon-96.png
        ├── icon-128.png
        ├── icon-144.png
        ├── icon-152.png
        ├── icon-192.png
        ├── icon-384.png
        └── icon-512.png
```

---

## 3. 기술 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT (Browser)                                       │
│  ┌────────┐  ┌────────┐  ┌─────────────────┐          │
│  │  HTML   │  │  CSS   │  │   app.js (SPA)  │          │
│  │  (SPA)  │  │ Themes │  │  State Machine  │          │
│  └────────┘  └────────┘  └────────┬────────┘          │
│                                    │ fetch()            │
│  ┌────────────────────────────────┐│                   │
│  │  Service Worker (캐시 전략)     ││                   │
│  │  - 정적: Cache First           ││                   │
│  │  - API: Network First          ││                   │
│  └────────────────────────────────┘│                   │
└────────────────────────────────────┼───────────────────┘
                                     │ HTTPS
┌────────────────────────────────────┼───────────────────┐
│  SERVER (Vercel Serverless)        │                   │
│  ┌─────────────────────────────────▼─────────────────┐ │
│  │  Express.js                                        │ │
│  │  ├─ Helmet (보안 헤더)                              │ │
│  │  ├─ CORS (출처 제한)                               │ │
│  │  ├─ Rate Limiter (100req/min)                     │ │
│  │  ├─ Slow Down (80req 이후 지연)                    │ │
│  │  └─ Static Files (public/)                        │ │
│  └─────────────────────────────────┬─────────────────┘ │
└────────────────────────────────────┼───────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────┐
         │                           │                    │
    ┌────▼─────┐             ┌──────▼───────┐           │
    │ MongoDB  │             │   Firebase    │           │
    │  Atlas   │             │   Storage     │           │
    │          │             │               │           │
    │ bible_db │             │ 찬송가 악보    │           │
    │ └ verses │             │ 이미지 (JPG)  │           │
    │          │             │               │           │
    │ Hymn     │             │               │           │
    │ └ hymns  │             │               │           │
    └──────────┘             └───────────────┘           │
         └───────────────────────────────────────────────┘
```

---

## 4. 백엔드 (서버)

### 4.1 서버 구성 (`server.js`, 208줄)

**의존성 패키지:**

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `express` | ^4.21.2 | 웹 프레임워크 |
| `mongodb` | ^6.12.0 | MongoDB 드라이버 |
| `helmet` | ^8.1.0 | HTTP 보안 헤더 |
| `cors` | ^2.8.6 | CORS 정책 관리 |
| `express-rate-limit` | ^8.2.1 | 요청 수 제한 |
| `express-slow-down` | ^3.0.1 | 요청 속도 제한 |
| `dotenv` | ^16.4.7 | 환경 변수 로딩 |
| `sharp` | ^0.34.5 | 이미지 처리 (devDep) |

### 4.2 데이터베이스 연결

서버 시작 시 **2개의 MongoDB Atlas 클러스터**에 연결합니다:

```javascript
// Bible DB: 성경 구절 데이터
db = client.db('bible_db');          // 컬렉션: verses

// Hymn DB: 찬송가 메타데이터
hymnDb = hymnClient.db('Hymn');      // 컬렉션: hymns
```

### 4.3 API 엔드포인트

| Method | Endpoint | 설명 | 응답 |
|--------|----------|------|------|
| `GET` | `/api/books` | 성경 66권 목록 | `[{bookIndex, bookName, testament}]` |
| `GET` | `/api/books/:bookIndex/chapters` | 특정 책의 장 목록 | `[{chapter}]` |
| `GET` | `/api/books/:bookIndex/chapters/:chapter` | 특정 장의 전체 구절 | `[{verse, content, headline, ...}]` |
| `GET` | `/api/hymns` | 찬송가 전체 목록 | `[{chapter}]` |
| `GET` | `/api/hymns/:chapter` | 특정 찬송가 상세 정보 | `{chapter, downloadUrl, ...}` |

### 4.4 파라미터 검증

모든 API 파라미터는 `validateInt()` 헬퍼로 검증됩니다:
- `bookIndex`: 1 ~ 66 사이 정수
- `chapter` (성경): 1 ~ 150 사이 정수
- `chapter` (찬송가): 1 ~ 645 사이 정수

### 4.5 에러 처리

- 존재하지 않는 API 경로: `404` 응답
- 전역 에러 핸들러: 모든 미처리 에러를 `500`으로 응답
- 클라이언트에 내부 구현 세부사항 노출 방지

---

## 5. 프론트엔드 (클라이언트)

### 5.1 SPA (Single Page Application)

**프레임워크 없이(Vanilla JS)** SPA를 구현했습니다. 5개의 뷰를 CSS `display` 속성으로 전환합니다:

```
┌──────────────────────┐
│     books-view       │  ← 책 목록 (구약/신약/찬송가 탭)
├──────────────────────┤
│    chapters-view     │  ← 장 선택 그리드
├──────────────────────┤
│     verses-view      │  ← 구절 읽기
├──────────────────────┤
│     hymns-view       │  ← 찬송가 목록 (미사용, books-view 내 hymn-mode로 대체)
├──────────────────────┤
│  hymn-detail-view    │  ← 찬송가 악보 상세
└──────────────────────┘
```

### 5.2 상태 관리

글로벌 `state` 객체로 앱 상태를 중앙 관리합니다:

```javascript
const state = {
    books: [],                  // 성경 66권 목록
    currentTestament: 'Old',    // 현재 탭 ('Old'|'New'|'Hymn')
    currentBook: null,          // 현재 선택된 책
    currentChapter: null,       // 현재 장 번호
    totalChapters: 0,           // 현재 책의 총 장 수
    verses: [],                 // 현재 장의 구절 배열
    selectedVerses: new Set(),  // 선택된 구절 번호 집합
    hymns: [],                  // 찬송가 목록
    currentHymn: null,          // 현재 찬송가 번호
    totalHymns: 645,            // 총 찬송가 수
};
```

### 5.3 네비게이션 흐름

```
[책 목록] ──클릭──▶ [장 선택] ──클릭──▶ [구절 읽기]
    │                  ▲                    │
    │               ◀──뒤로 버튼──────────────┘
    │
    │──찬송가 탭──▶ [찬송가 목록] ──클릭──▶ [찬송가 상세]
                        ▲                     │
                     ◀──뒤로 버튼──────────────┘
```

### 5.4 데이터 캐싱 & 프리페치

```javascript
const versesCache = {};  // 메모리 캐시: {bookIndex}-{chapter} → verses[]

// 현재 장을 로드한 후 인접 장을 미리 가져옴
prefetchChapter(bookIndex, chapter - 1);
prefetchChapter(bookIndex, chapter + 1);
```

### 5.5 스와이프 네비게이션

총 **3가지 스와이프 영역**이 구현되어 있습니다:

#### ① 구절 뷰 스와이프 (좌우 → 이전/다음 장)
- 임계값: 50px
- 캐러셀 영역 터치 시 스와이프 무시

#### ② 메인 뷰(책 목록) 스와이프 (좌우 → 구약/신약/찬송가 탭 전환)
- 임계값: 60px
- 드래그 중 실시간 `translateX` + 투명도 변화
- 화면 밖으로 날아가는 애니메이션 → 반대편에서 새 컨텐츠 슬라이드 인
- `Reflow` 강제 발생으로 즉시 위치 초기화

#### ③ 찬송가 상세 스와이프 (좌우 → 이전/다음 찬송가)
- 임계값: 60px
- 첫 장/마지막 장에서 텐션(저항) 효과: `translateX(dx * 0.3)`
- 오버스크롤 시 덜 밀리는 UX

### 5.6 구절 선택 & 공유

```
구절 클릭 → selectedVerses Set에 추가/제거
         → 하이라이트 UI 업데이트
         → FAB 버튼 표시/숨김
         → 공유 클릭 시:
            ├─ navigator.share() 지원: 네이티브 공유 시트
            └─ 미지원: 클립보드 복사 + 토스트 알림
```

**공유 텍스트 생성 규칙:**
- 연속 구절: `창세기 1:1-3`
- 비연속 구절: `창세기 1:1, 3, 5`
- 본문 내용 포함

### 5.7 챕터 캐러셀

구절 뷰와 찬송가 상세 뷰 상단에 **수평 스크롤 캐러셀**이 있습니다:

- 현재 장/곡을 가운데로 자동 스크롤
- 스크롤 방향 감지: 아래로 스크롤 시 숨김, 위로 스크롤 시 표시
- `scroll-snap-type: x mandatory`로 스냅 포인트 적용
- CSS 마스크로 좌우 끝 페이드 아웃 효과

### 5.8 챕터 네비게이션 바

구절 뷰 하단의 이전/다음 장 버튼:
- 이전/다음 장 번호 표시
- 첫 장/마지막 장에서 비활성화
- 현재 위치 표시: `3 / 50`

---

## 6. PWA (Progressive Web App)

### 6.1 매니페스트 (`manifest.json`)

```json
{
    "name": "개역개정 성경",
    "short_name": "성경",
    "display": "standalone",
    "orientation": "portrait",
    "theme_color": "#1a1a2e",
    "background_color": "#121220",
    "lang": "ko"
}
```

- **8종 아이콘**: 72, 96, 128, 144, 152, 192, 384, 512px
- `purpose: "any maskable"` (192, 512px)

### 6.2 서비스 워커 (`service-worker.js`)

**캐시 전략:**

| 리소스 유형 | 전략 | 설명 |
|------------|------|------|
| 정적 파일 (HTML, CSS, JS, 아이콘) | **Cache First** | 캐시에 있으면 캐시 반환, 없으면 네트워크 |
| API 요청 (`/api/*`) | **Network First** | 네트워크 우선, 실패 시 캐시 폴백 |
| 외부 리소스 (Firebase Storage) | **패스스루** | SW가 개입하지 않음 (모바일 호환성) |

**사전 캐시 리소스:**
```javascript
const PRECACHE_ASSETS = [
    '/', '/index.html', '/style.css', '/app.js',
    '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png',
];
```

**핵심 설계 결정:**
- 외부 origin 요청(Firebase Storage 등)은 SW가 개입하지 않습니다
- 이 결정은 모바일 Safari/Samsung Internet에서 이미지 로딩 실패 문제를 해결하기 위해 내려졌습니다

---

## 7. 찬송가 기능

### 7.1 데이터 소스

- **악보 이미지**: Firebase Storage (`hymn-705c2.firebasestorage.app`)
- **메타데이터**: MongoDB Atlas (`Hymn` DB → `hymns` 컬렉션)
- **총 645곡**의 악보 JPG 이미지

### 7.2 악보 다운로드 과정 (개발 시)

1. `https://bibletoppt.com/hymn/sheet-music/` 에서 645곡 악보 이미지 수집
2. **Selenium + Edge 브라우저 (Headless)** 스크립트로 자동 다운로드
3. 각 페이지에서 다운로드 트리거 클릭 → 토큰화된 URL 대기 → JPG 저장
4. 다운로드된 이미지를 Firebase Storage에 업로드
5. MongoDB에 메타데이터(장 번호, downloadUrl) 저장

### 7.3 이미지 로딩 전략

```javascript
// 브라우저 DOM 캐싱 버그 방지를 위한 메모리 프리로딩
const newImg = new Image();
newImg.src = hymn.downloadUrl;

newImg.onload = () => {
    // Race condition 방지: 사용자가 다른 곡으로 넘기지 않았을 때만 표시
    if (state.currentHymn === chapter) {
        hymnDetailContent.innerHTML = '';
        hymnDetailContent.appendChild(newImg);
    }
};

newImg.onerror = () => {
    // 첫 실패 시 캐시 무시 재시도
    newImg.src = `${hymn.downloadUrl}?retry=${Date.now()}`;
};
```

### 7.4 찬송가 검색

- `inputmode="numeric"` 으로 모바일에서 숫자 키패드 표시
- 실시간 필터링: 입력한 숫자를 포함하는 장 번호만 표시
- Enter 키 입력 시 해당 장으로 바로 이동

---

## 8. 설정 패널

### 8.1 설정 항목

| 설정 | 저장 키 | 기본값 | 범위/옵션 |
|------|---------|--------|----------|
| 다크 모드 | `bible-theme` | `dark` | `dark` / `light` |
| 글자 크기 | `bible-fontSize` | `16` | 12 ~ 24px |
| 굵은 글씨 | `bible-bold` | `false` | on/off |
| 글씨체 | `bible-fontFamily` | `serif` | 명조체 / 고딕체 / 프리텐다드 |
| 하단 정렬 | `bible-bottomAlign` | `false` | on/off |

### 8.2 글씨체 매핑

```javascript
const FONT_MAP = {
    serif: "'Noto Serif KR', serif",
    sans: "'Noto Sans KR', sans-serif",
    pretendard: "'Pretendard', 'Noto Sans KR', sans-serif",
};
```

### 8.3 영속성

모든 설정은 `localStorage`에 저장되어 브라우저를 닫았다 열어도 유지됩니다.

---

## 9. UI/UX 디자인

### 9.1 디자인 시스템 (CSS Variables)

#### 다크 테마 (기본)
```css
--bg-primary: #0f1117;
--bg-secondary: #1a1d28;
--bg-card: #222636;
--text-primary: #e8eaf0;
--accent: #6387ff;
--accent-secondary: #8b5cf6;
```

#### 라이트 테마
```css
--bg-primary: #f5f6fa;
--bg-secondary: #ecedf2;
--bg-card: #ffffff;
--text-primary: #1e1f26;
--accent: #4e6ee5;
```

### 9.2 애니메이션

| 애니메이션 | 용도 | 지속 시간 |
|-----------|------|----------|
| `fadeIn` | 뷰 전환 | 0.3s |
| `slideOutLeft/Right` | 장 전환 (나가기) | 0.2s |
| `slideInLeft/Right` | 장 전환 (들어오기) | 0.3s |
| `fabIn/fabOut` | 공유 FAB 버튼 | 0.35s / 0.25s |
| `panelIn` | 설정 패널 열기 | 0.2s |
| `spin` | 로딩 스피너 | 1s (무한 반복) |

### 9.3 반응형 디자인

```
480px 이하     : 3열 그리드, 작은 패딩/폰트
768px 이상     : 5열(책) / 10열(장/찬송가), 넓은 패딩
1200px 이상    : 6열(책), max-width 1100px
```

### 9.4 기타 UI 세부사항

- **스크롤바 커스터마이징**: 6px 너비, 반투명, 둥근 모서리
- **탭 하이라이트 제거**: `-webkit-tap-highlight-color: transparent`
- **단어 잘림 방지**: `word-break: keep-all; overflow-wrap: break-word`
- **캐러셀 마스크**: 좌우 끝 그라데이션 페이드 효과
- **토스트 알림**: 하단 중앙, pill 모양, 2.5초 자동 닫기
- **구절 헤드라인**: 왼쪽 3px 보더, 악센트 배경, 소제목 스타일
- **로딩 스피너**: 그라데이션 보더 + 글로우 효과

---

## 10. 보안

### 10.1 보안 미들웨어 스택

```
요청 → Helmet → CORS → Body Limit → Rate Limit → Slow Down → 라우터
```

#### Helmet (HTTP 보안 헤더)
```javascript
contentSecurityPolicy: {
    directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
        fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net", "data:"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "storage.googleapis.com",
                  "firebasestorage.googleapis.com", "hymn-705c2.firebasestorage.app"],
    }
}
```

#### Rate Limiter
- **1분당 100회** 요청 제한 (IP 기준)
- 초과 시 에러 메시지: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."

#### Slow Down
- 1분 내 **80회 요청 이후** 점진적 지연
- 초과 1회당 **100ms** 추가 (최대 5초)

#### 기타
- `trust proxy: 1` (Vercel 리버스 프록시 대응)
- 요청 본문 크기 제한: `10kb`
- GET 요청만 허용

---

## 11. 배포

### 11.1 Vercel 배포 설정 (`vercel.json`)

```json
{
    "version": 2,
    "builds": [
        { "src": "server.js", "use": "@vercel/node" }
    ],
    "routes": [
        { "src": "/api/(.*)", "dest": "server.js" },
        { "src": "/(.*)", "dest": "server.js" }
    ]
}
```

- **서버리스 함수**: `@vercel/node`로 Express 서버 래핑
- 모든 요청이 `server.js`로 라우팅됨

### 11.2 환경 변수

| 변수명 | 용도 |
|--------|------|
| `MONGODB_URI` | Bible DB 연결 문자열 |
| `MONGODB_URI_HYMN` | Hymn DB 연결 문자열 |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage 버킷명 |
| `ALLOWED_ORIGINS` | CORS 허용 출처 (쉼표 구분) |

---

## 12. 개발 타임라인

| 날짜 | 작업 내용 |
|------|----------|
| **2026-01-12** | 버튼 디자인 리파인, 모바일 반응형 최적화 |
| **2026-02-14** | 버튼 애니메이션 속도 조정 |
| **2026-02-22 (오전)** | 성경 데이터 MongoDB 저장 프로그램 개발 |
| **2026-02-22 (오후)** | 설정 패널 구현 (다크모드, 글자 크기, 볼드, 글씨체, 하단 정렬) |
| **2026-02-22 (오후)** | 모바일 SVG 클릭 호환성 수정, CSP 조정, 폰트 로딩 개선 |
| **2026-02-22 (저녁)** | 찬송가 악보 다운로더 개발 (Python + requests) |
| **2026-02-22~23** | Selenium Edge 브라우저로 645곡 악보 다운로드 완료 |
| **2026-02-23** | 찬송가 이미지 로딩 문제 해결 — CSP 설정, SW 외부 요청 패스스루, 재시도 로직 |

---

## 13. 데이터베이스 스키마

### 13.1 Bible DB (`bible_db.verses`)

```json
{
    "_id": "ObjectId",
    "bookIndex": 1,           // 책 번호 (1~66)
    "bookName": "창세기",      // 책 이름
    "testament": "Old",        // "Old" 또는 "New"
    "chapter": 1,              // 장 번호
    "verse": 1,                // 절 번호
    "content": "태초에 하나님이 천지를 창조하시니라",
    "headline": "천지 창조"     // 소제목 (선택)
}
```

### 13.2 Hymn DB (`Hymn.hymns`)

```json
{
    "_id": "ObjectId",
    "chapter": 1,                    // 찬송가 장 번호 (1~645)
    "downloadUrl": "https://..."     // Firebase Storage 이미지 URL
}
```

---

## 14. 향후 개선 사항

- [ ] 북마크/즐겨찾기 기능
- [ ] 성경 검색 기능 (전문 검색)
- [ ] 읽기 기록 추적
- [ ] 오프라인 성경 데이터 완전 캐싱
- [ ] 찬송가 가사 텍스트 검색
- [ ] 다국어 성경 지원
- [ ] 메모/하이라이트 기능

---

> *이 문서는 프로젝트의 전체 개발 내역을 기록한 것으로, 코드 분석과 대화 기록을 바탕으로 작성되었습니다.*
