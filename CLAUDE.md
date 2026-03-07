# 개역개정 성경 웹앱 (Bible App)

## 프로젝트 개요
개역개정 성경 + 찬송가 웹앱. PWA 지원. Vercel 배포.
- 📚 성경 66권(구약 39 + 신약 27), 장/절 단위 탐색
- 🎵 찬송가 645곡 악보 이미지 (Firebase Storage)
- 🔗 구절 선택 → 클립보드 복사 / 네이티브 공유
- ⚙️ 설정: 다크모드, 글자 크기, 글씨체, 굵기, 하단 정렬
- 📱 PWA (홈 화면 설치, 오프라인 캐싱)
- 👆 스와이프 네비게이션 (탭/장/찬송가 이동)

## 기술 스택
- **백엔드**: Node.js + Express (server.js 단일 파일, 208줄)
- **프론트엔드**: Vanilla JS + CSS (프레임워크 없음, public/)
- **DB**: MongoDB Atlas (bible_db → verses, Hymn → hymns)
- **이미지**: Firebase Storage (hymn-705c2.firebasestorage.app)
- **배포**: Vercel 서버리스 (@vercel/node)
- **PWA**: service-worker.js (Cache First + Network First)

## 프로젝트 구조
```
server.js              ← Express 서버 (API + 정적 파일 서빙)
vercel.json            ← Vercel 배포 설정
.env                   ← 환경 변수 (MONGODB_URI, MONGODB_URI_HYMN, ALLOWED_ORIGINS)
public/
  index.html           ← 성경 책 목록 (메인)
  chapters.html/js     ← 장 목록
  verses.html/js       ← 구절 보기
  hymns.html/js        ← 찬송가 목록
  hymn.html/js         ← 찬송가 악보 보기
  app.js               ← SPA용 메인 앱 로직 (레거시, 현재 미사용)
  books.js             ← 메인 페이지 탭/스와이프/책 목록 로직
  common.js            ← 공통 유틸 (fetchJSON, 설정 패널, 토스트 등)
  style.css            ← 전체 스타일 (1,086줄)
  service-worker.js    ← PWA 캐시 (현재 v14)
  manifest.json        ← PWA 매니페스트
  icons/               ← PWA 아이콘 (72~512px, 8종)
```

## API 엔드포인트
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/books` | 성경 66권 목록 `[{bookIndex, bookName, testament}]` |
| GET | `/api/books/:bookIndex/chapters` | 특정 책의 장 목록 `[{chapter}]` |
| GET | `/api/books/:bookIndex/chapters/:chapter` | 특정 장의 구절 전체 |
| GET | `/api/hymns` | 찬송가 목록 (장 번호만) |
| GET | `/api/hymns/:chapter` | 특정 찬송가 (downloadUrl 포함) |

## 네비게이션 흐름
```
[메인 책 목록] ──클릭──▶ [장 선택] ──클릭──▶ [구절 읽기]
      │                    ▲                     │
      │               history.back() ◀───────────┘
      │
      │──찬송가 탭──▶ [찬송가 목록] ──클릭──▶ [찬송가 상세]
                          ▲                      │
                     history.back() ◀────────────┘
```
- 장(chapter) 간 이동: `history.replaceState` (히스토리 추가 안 함)
- 뒤로가기: `history.back()` 사용 (window.location.href 금지)

## 스와이프 제스처
| 영역 | 동작 | 임계값 |
|------|------|--------|
| 메인(책 목록) | 구약/신약/찬송가 탭 전환 | 60px |
| 구절 뷰 | 이전/다음 장 | 50px |
| 찬송가 상세 | 이전/다음 곡 (첫/끝 텐션 효과) | 60px |

## 캐싱 전략
- **Service Worker**: 정적 파일 → Cache First, API → Network First, 외부(Firebase) → 패스스루
- **메모리 캐시**: `versesCache[bookIndex-chapter]`로 구절 캐싱 + 인접 장 프리페치

## 설정 (localStorage)
| 설정 | 키 | 기본값 | 범위 |
|------|-----|--------|------|
| 테마 | `bible-theme` | `dark` | dark/light |
| 글자 크기 | `bible-fontSize` | `16` | 12~24px |
| 굵기 | `bible-bold` | `false` | on/off |
| 글씨체 | `bible-fontFamily` | `serif` | 명조/고딕/프리텐다드 |
| 하단 정렬 | `bible-bottomAlign` | `false` | on/off |
| 화면 꺼짐 방지 | `bible-wakeLock` | `false` | on/off |
| 본문 폭 | `bible-contentWidth` | `95` | 80~100% |

## 보안 미들웨어
Helmet(CSP) → CORS → Body Limit(10kb) → Rate Limit(100req/min) → Slow Down(80req 이후 지연)

## DB 스키마
```
bible_db.verses: { bookIndex, bookName, testament, chapter, verse, content, headline }
Hymn.hymns:      { chapter, downloadUrl, storagePath }
```

## 주요 규칙
- 모든 응답과 주석은 **한국어**로 작성
- 프론트엔드에 프레임워크 사용하지 않음 (Vanilla JS 유지)
- `.env`에 `MONGODB_URI`, `MONGODB_URI_HYMN`, `ALLOWED_ORIGINS` 존재
- PowerShell에서는 && 대신 ;을 사용해야 함

## 실행 방법
```bash
npm run dev   # node server.js (포트 3000)
```

## 주의사항
- 정적 파일 수정 시 `service-worker.js`의 `CACHE_NAME` 버전을 반드시 올려야 반영됨 (현재 v23)
- `window.location.href`는 히스토리 엔트리를 추가하므로 뒤로가기에는 `history.back()` 사용
- 스와이프 시 `overflow-x: hidden`이 html, body, #app 모두에 필요 (fixed 요소 밀림 방지)
- 외부 origin 요청(Firebase)은 SW 패스스루 (모바일 이미지 로딩 호환성)

## 개발 타임라인
| 날짜 | 작업 |
|------|------|
| 2026-01-12 | 버튼 디자인, 모바일 반응형 |
| 2026-02-14 | 버튼 애니메이션 조정 |
| 2026-02-22 | 설정 패널, 찬송가 다운로더, MongoDB 저장 |
| 2026-02-23 | 찬송가 이미지 로딩 문제 해결 (CSP, SW 패스스루) |
| 2026-03-03 | .claudeignore/CLAUDE.md 생성, 스와이프 버그 수정, 히스토리 버그 수정, SW v14 |
| 2026-03-04 | 찬송가 탭 인라인 패널화 (index.html 내 통합), 탭바 연속성 유지, SW v15 |
| 2026-03-04 | 로더 정렬 버그, headline 보더 버그 수정, 캐러셀 인디케이터 스무스 개선 |
| 2026-03-04 | 구절 형광펜 기능 추가 (localStorage, 길게 누르기), SW v20 |
| 2026-03-05 | 형광펜 5색 + 색상 선택 팝업, 팝업 외부 클릭 닫힘 버그 수정, SW v22 |
| 2026-03-07 | 하이라이트 잔상 버그 수정(loadVerses 즉시 초기화), Wake Lock(화면 꺼짐 방지), 본문 폭 슬라이더(--verse-padding), SW v23 |

