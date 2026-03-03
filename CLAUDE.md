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

## 실행 방법
```bash
npm run dev   # node server.js (포트 3000)
```
