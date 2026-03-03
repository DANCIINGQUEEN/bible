# 개역개정 성경 웹앱 (Bible App)

## 프로젝트 개요
개역개정 성경 + 찬송가 웹앱. PWA 지원. Vercel 배포.

## 기술 스택
- **백엔드**: Node.js + Express (server.js 단일 파일)
- **프론트엔드**: Vanilla JS + CSS (프레임워크 없음, public/ 디렉토리)
- **DB**: MongoDB Atlas (bible_db, Hymn 두 개 DB)
- **배포**: Vercel (vercel.json)
- **PWA**: service-worker.js, manifest.json

## 프로젝트 구조
```
server.js          ← Express 서버 (API + 정적 파일 서빙)
public/
  index.html       ← 성경 책 목록 (메인)
  chapters.html    ← 장 목록
  verses.html      ← 구절 보기
  hymn.html        ← 찬송가 악보 보기
  hymns.html       ← 찬송가 목록
  app.js           ← 메인 앱 로직 (성경 책 목록)
  books.js         ← 성경 66권 데이터
  common.js        ← 공통 유틸 (다크모드, 설정 등)
  style.css        ← 전체 스타일
  service-worker.js
  manifest.json
```

## API 엔드포인트
- `GET /api/books` — 성경 책 목록
- `GET /api/books/:bookIndex/chapters` — 특정 책의 장 목록
- `GET /api/books/:bookIndex/chapters/:chapter` — 특정 장의 구절
- `GET /api/hymns` — 찬송가 목록
- `GET /api/hymns/:chapter` — 특정 찬송가 조회

## 주요 규칙
- 모든 응답과 주석은 **한국어**로 작성
- 프론트엔드에 프레임워크 사용하지 않음 (Vanilla JS 유지)
- 보안 미들웨어: Helmet, CORS, Rate Limit, Slow Down 적용 중
- `.env`에 `MONGODB_URI`, `MONGODB_URI_HYMN`, `ALLOWED_ORIGINS` 존재
- 찬송가 악보 이미지는 Firebase Storage에 저장
- PowerShell에서는 && 대신 ;을 사용해야 함

## 실행 방법
```bash
npm run dev   # node server.js (포트 3000)
```

## 주의사항
- 정적 파일(JS/CSS/HTML) 수정 시 `service-worker.js`의 `CACHE_NAME` 버전을 반드시 올려야 브라우저에 반영됨 (현재 v14)
- 페이지 간 이동 시 `window.location.href`는 히스토리 엔트리를 추가하므로, 뒤로가기 용도에는 `history.back()` 사용
- 장(chapter) 이동은 `history.replaceState`로 URL만 변경 (히스토리 추가 안 함)
- 스와이프 제스처 구현 시 `overflow-x: hidden`이 html, body, #app 모두에 필요 (모바일 브라우저에서 fixed 요소 밀림 방지)

## 개발 이력 (2026-03-03)
- `.claudeignore`, `CLAUDE.md` 생성
- 스와이프 시 설정아이콘(⚙️) 밀리는 버그 수정 (`style.css` overflow 처리)
- 뒤로가기 히스토리 버그 수정 (`verses.js` → `history.back()`)
- Service Worker 캐시 버전 v13 → v14
