// ===== Service Worker 등록 =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((reg) => console.log('SW 등록 성공:', reg.scope))
            .catch((err) => console.log('SW 등록 실패:', err));
    });
}

// ===== State =====
const state = {
    books: [],
    currentTestament: 'Old',
    currentBook: null,
    currentChapter: null,
    totalChapters: 0,
    verses: [],
    selectedVerses: new Set(),
    hymns: [],
    currentHymn: null,
    totalHymns: 645,
};

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const headerTitle = $('#header-title');
const backBtn = $('#back-btn');
const booksView = $('#books-view');
const chaptersView = $('#chapters-view');
const versesView = $('#verses-view');
const booksList = $('#books-list');
const chaptersGrid = $('#chapters-grid');
const versesContent = $('#verses-content');
const shareFab = $('#share-fab');
const toast = $('#toast');
const prevChapterBtn = $('#prev-chapter');
const nextChapterBtn = $('#next-chapter');
const prevLabel = $('#prev-label');
const nextLabel = $('#next-label');
const chapterIndicator = $('#chapter-indicator');
const chapterCarouselWrap = $('#chapter-carousel-wrap');
const chapterCarousel = $('#chapter-carousel');
const hymnsView = $('#hymns-view');
const hymnsGrid = $('#hymns-grid');
const hymnDetailView = $('#hymn-detail-view');
const hymnDetailContent = $('#hymn-detail-content');
const hymnCarouselWrap = $('#hymn-carousel-wrap');
const hymnCarousel = $('#hymn-carousel');

// ===== API =====
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ===== History / Routing =====
// action: 'push' | 'replace' | 'skip'
function updateHistory(action, historyState, hash) {
    const url = location.pathname + '#' + hash;
    if (action === 'push') history.pushState(historyState, '', url);
    else if (action === 'replace') history.replaceState(historyState, '', url);
    // 'skip': 히스토리 변경 없음 (popstate 복원 시 사용)
}

// ===== Views =====
function showView(viewId) {
    [booksView, chaptersView, versesView, hymnsView, hymnDetailView].forEach(v => v.classList.remove('active'));
    $(viewId).classList.add('active');
}

function navigateTo(view, historyAction = 'push') {
    clearSelection();
    // 기본적으로 캐러셀 숨기기
    chapterCarouselWrap.classList.add('hidden');
    hymnCarouselWrap.classList.add('hidden');

    if (view === 'books') {
        showView('#books-view');
        headerTitle.textContent = '개역개정 성경';
        backBtn.classList.add('hidden');
        state.currentBook = null;
        state.currentChapter = null;

        // 올바른 탭 활성화 복원
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-btn[data-testament="${state.currentTestament}"]`);
        if (activeTab) activeTab.classList.add('active');

        booksList.classList.remove('hymn-mode');
        if (state.books.length > 0) renderBooks();

        updateHistory(historyAction, { view: 'books', testament: state.currentTestament }, `tab/${state.currentTestament}`);
    } else if (view === 'chapters') {
        showView('#chapters-view');
        headerTitle.textContent = state.currentBook.bookName;
        backBtn.classList.remove('hidden');

        updateHistory(historyAction, { view: 'chapters', bookIndex: state.currentBook.bookIndex }, `book/${state.currentBook.bookIndex}`);
    } else if (view === 'verses') {
        showView('#verses-view');
        headerTitle.textContent = `${state.currentBook.bookName} ${state.currentChapter}장`;
        backBtn.classList.remove('hidden');
        chapterCarouselWrap.classList.remove('hidden');
        chapterCarouselWrap.classList.remove('carousel-hidden');
        carouselHidden = false;
        lastScrollY = 0;

        updateHistory(
            historyAction,
            { view: 'verses', bookIndex: state.currentBook.bookIndex, chapter: state.currentChapter, totalChapters: state.totalChapters },
            `book/${state.currentBook.bookIndex}/chapter/${state.currentChapter}`
        );
    } else if (view === 'hymns') {
        showView('#hymns-view');
        headerTitle.textContent = '찬송가';
        backBtn.classList.remove('hidden');
        updateHistory(historyAction, { view: 'hymns' }, 'hymns');
    } else if (view === 'hymnDetail') {
        showView('#hymn-detail-view');
        headerTitle.textContent = `찬송가 ${state.currentHymn}장`;
        backBtn.classList.remove('hidden');
        hymnCarouselWrap.classList.remove('hidden');
        hymnCarouselWrap.classList.remove('carousel-hidden');
        carouselHidden = false;
        lastScrollY = 0;

        updateHistory(historyAction, { view: 'hymnDetail', hymn: state.currentHymn }, `hymn/${state.currentHymn}`);
    }
}

// ===== Back Navigation =====
backBtn.addEventListener('click', () => {
    history.back();
});

// ===== Popstate (브라우저 뒤로가기/앞으로가기) =====
window.addEventListener('popstate', async (e) => {
    const s = e.state;
    if (!s) {
        state.currentTestament = 'Old';
        navigateTo('books', 'skip');
        return;
    }

    switch (s.view) {
        case 'books':
            state.currentTestament = s.testament;
            navigateTo('books', 'skip');
            break;
        case 'chapters':
            if (state.books.length > 0) {
                state.currentBook = state.books.find(b => b.bookIndex === s.bookIndex);
            }
            await loadChapters(s.bookIndex, 'skip');
            break;
        case 'verses':
            if (state.books.length > 0) {
                state.currentBook = state.books.find(b => b.bookIndex === s.bookIndex);
            }
            state.currentChapter = s.chapter;
            state.totalChapters = s.totalChapters;
            await loadVerses(s.bookIndex, s.chapter, null, 'skip');
            break;
        case 'hymns':
            await loadHymnsView('skip');
            break;
        case 'hymnDetail':
            state.currentHymn = s.hymn;
            await loadHymnDetail(s.hymn, 'skip');
            break;
    }
});

// ===== Load Books =====
async function loadBooks() {
    booksList.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        state.books = await fetchJSON('/api/books');
        renderBooks();
    } catch (err) {
        booksList.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

function renderBooks() {
    booksList.classList.remove('hymn-mode');
    booksList.classList.add('books-grid');
    const filtered = state.books.filter(b => b.testament === state.currentTestament);
    booksList.innerHTML = filtered.map(book => `
    <button class="book-btn" data-index="${book.bookIndex}">
      ${book.bookName}
    </button>
  `).join('');

    booksList.querySelectorAll('.book-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            state.currentBook = state.books.find(b => b.bookIndex === idx);
            loadChapters(idx);
        });
    });
}

// ===== Testament Tabs =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const testament = btn.dataset.testament;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTestament = testament;

        if (testament === 'Hymn') {
            // 찬송가는 별도 뷰(hymns-view)로 이동 — 더 깊은 레벨이므로 push
            loadHymnsView();
        } else {
            booksList.classList.remove('hymn-mode');
            renderBooks();
            // 탭 전환은 같은 레벨이므로 replaceState
            updateHistory('replace', { view: 'books', testament }, `tab/${testament}`);
        }
    });
});

// ===== Load Chapters =====
async function loadChapters(bookIndex, historyAction = 'push') {
    navigateTo('chapters', historyAction);
    chaptersGrid.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        const chapters = await fetchJSON(`/api/books/${bookIndex}/chapters`);
        state.totalChapters = chapters.length;
        chaptersGrid.innerHTML = chapters.map(c => `
      <button class="chapter-btn" data-chapter="${c.chapter}">
        ${c.chapter}
      </button>
    `).join('');

        chaptersGrid.querySelectorAll('.chapter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.currentChapter = parseInt(btn.dataset.chapter);
                loadVerses(bookIndex, state.currentChapter);
            });
        });
    } catch (err) {
        chaptersGrid.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

// ===== Load Verses =====
const versesCache = {};

async function loadVerses(bookIndex, chapter, direction, historyAction = 'push') {
    navigateTo('verses', historyAction);

    // 애니메이션 방향 결정
    if (direction) {
        const slideOut = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
        const slideIn = direction === 'next' ? 'slide-in-right' : 'slide-in-left';
        versesContent.classList.add(slideOut);
        await new Promise(r => setTimeout(r, 200));
        versesContent.classList.remove(slideOut);
        versesContent.classList.add(slideIn);
        // slideIn 끝나면 클래스 제거
        setTimeout(() => versesContent.classList.remove(slideIn), 300);
    }

    const cacheKey = `${bookIndex}-${chapter}`;

    if (versesCache[cacheKey]) {
        state.verses = versesCache[cacheKey];
        renderVerses();
        updateChapterNav();
        window.scrollTo({ top: 0 });
    } else {
        versesContent.innerHTML = '<div class="loader">불러오는 중...</div>';
        try {
            state.verses = await fetchJSON(`/api/books/${bookIndex}/chapters/${chapter}`);
            versesCache[cacheKey] = state.verses;
            renderVerses();
            updateChapterNav();
            window.scrollTo({ top: 0 });
        } catch (err) {
            versesContent.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
        }
    }

    // 인접 장 프리페치
    prefetchChapter(bookIndex, chapter - 1);
    prefetchChapter(bookIndex, chapter + 1);
}

async function prefetchChapter(bookIndex, chapter) {
    if (chapter < 1 || chapter > state.totalChapters) return;
    const cacheKey = `${bookIndex}-${chapter}`;
    if (versesCache[cacheKey]) return;
    try {
        versesCache[cacheKey] = await fetchJSON(`/api/books/${bookIndex}/chapters/${chapter}`);
    } catch (e) { /* 프리페치 실패 무시 */ }
}

function goToChapter(direction) {
    const delta = direction === 'next' ? 1 : -1;
    const nextCh = state.currentChapter + delta;
    if (nextCh < 1 || nextCh > state.totalChapters) return;
    state.currentChapter = nextCh;
    // 같은 레벨(구절 뷰) 내 이동 → replaceState
    loadVerses(state.currentBook.bookIndex, state.currentChapter, direction, 'replace');
}

function renderVerses() {
    let html = '';
    let lastHeadline = null;

    state.verses.forEach(v => {
        if (v.headline && v.headline !== lastHeadline) {
            html += `<div class="verse-headline">${v.headline}</div>`;
            lastHeadline = v.headline;
        }
        html += `
      <div class="verse-item" data-verse="${v.verse}">
        <span class="verse-num">${v.verse}</span>
        <span class="verse-text">${v.content}</span>
      </div>
    `;
    });

    versesContent.innerHTML = html;

    versesContent.querySelectorAll('.verse-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleVerse(parseInt(item.dataset.verse));
        });
    });
}

// ===== Chapter Carousel =====
function renderChapterCarousel() {
    const total = state.totalChapters;
    const current = state.currentChapter;

    chapterCarousel.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-carousel-btn' + (i === current ? ' active' : '');
        btn.textContent = i;
        btn.dataset.chapter = i;
        btn.addEventListener('click', () => {
            if (i === state.currentChapter) return;
            const dir = i > state.currentChapter ? 'next' : 'prev';
            state.currentChapter = i;
            // 캐러셀은 같은 레벨 내 이동 → replaceState
            loadVerses(state.currentBook.bookIndex, i, dir, 'replace');
        });
        chapterCarousel.appendChild(btn);
    }

    // 현재 장을 가운데로 스크롤
    scrollCarouselToCenter(current);
}

function scrollCarouselToCenter(chapter) {
    requestAnimationFrame(() => {
        const activeBtn = chapterCarousel.querySelector('.chapter-carousel-btn.active') ||
            chapterCarousel.children[chapter - 1];
        if (!activeBtn) return;
        const containerWidth = chapterCarousel.offsetWidth;
        const btnLeft = activeBtn.offsetLeft;
        const btnWidth = activeBtn.offsetWidth;
        chapterCarousel.scrollTo({
            left: btnLeft - containerWidth / 2 + btnWidth / 2,
            behavior: 'smooth'
        });
    });
}

function updateCarouselActive() {
    chapterCarousel.querySelectorAll('.chapter-carousel-btn').forEach(btn => {
        const ch = parseInt(btn.dataset.chapter);
        btn.classList.toggle('active', ch === state.currentChapter);
    });
    scrollCarouselToCenter(state.currentChapter);
}

// 스크롤 방향 감지 → 캐러셀 숨기기/보이기
let lastScrollY = 0;
let carouselHidden = false;

window.addEventListener('scroll', () => {
    const inVerses = versesView.classList.contains('active');
    const inHymnDetail = hymnDetailView.classList.contains('active');
    if (!inVerses && !inHymnDetail) return;

    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;
    const wrap = inVerses ? chapterCarouselWrap : hymnCarouselWrap;

    if (delta > 5 && !carouselHidden) {
        wrap.classList.add('carousel-hidden');
        carouselHidden = true;
    } else if (delta < -5 && carouselHidden) {
        wrap.classList.remove('carousel-hidden');
        carouselHidden = false;
    }

    lastScrollY = currentY;
}, { passive: true });

// ===== Chapter Navigation =====
function updateChapterNav() {
    const ch = state.currentChapter;
    const total = state.totalChapters;

    prevChapterBtn.disabled = ch <= 1;
    nextChapterBtn.disabled = ch >= total;

    prevLabel.textContent = ch > 1 ? `${ch - 1}장` : '이전';
    nextLabel.textContent = ch < total ? `${ch + 1}장` : '다음';
    chapterIndicator.textContent = `${ch} / ${total}`;

    // 캐러셀이 비어있으면 새로 생성, 아니면 active 상태만 업데이트
    if (chapterCarousel.children.length !== total) {
        renderChapterCarousel();
    } else {
        updateCarouselActive();
    }
}

prevChapterBtn.addEventListener('click', () => goToChapter('prev'));
nextChapterBtn.addEventListener('click', () => goToChapter('next'));

// ===== Verses View Swipe Navigation =====
let touchStartX = 0;
let touchStartY = 0;
let touchOnCarousel = false;

versesView.addEventListener('touchstart', (e) => {
    touchOnCarousel = e.target.closest('.chapter-carousel-wrap') !== null;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

versesView.addEventListener('touchend', (e) => {
    if (touchOnCarousel) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        goToChapter(dx < 0 ? 'next' : 'prev');
    }
}, { passive: true });

// ===== Main View Swipe Navigation =====
let mainTouchStartX = 0;
let mainTouchStartY = 0;
let isMainSwiping = false;
const TESTAMENTS_ORDER = ['Old', 'New', 'Hymn'];

booksView.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.closest('.tab-btn')) return;
    mainTouchStartX = e.touches[0].clientX;
    mainTouchStartY = e.touches[0].clientY;
    isMainSwiping = true;
    booksList.style.transition = 'none'; // 드래그 중 애니메이션 제거
}, { passive: true });

booksView.addEventListener('touchmove', (e) => {
    if (!isMainSwiping) return;
    const dx = e.touches[0].clientX - mainTouchStartX;
    const dy = e.touches[0].clientY - mainTouchStartY;

    // 수평 이동거리 위주일 때만 책 목록 좌우로 움직이기
    if (Math.abs(dx) > Math.abs(dy)) {
        booksList.style.transform = `translateX(${dx}px)`;
        // 이동할수록 살짝 투명해지는 효과
        booksList.style.opacity = `${1 - Math.abs(dx) / (window.innerWidth * 1.5)}`;
    }
}, { passive: true });

booksView.addEventListener('touchend', (e) => {
    if (!isMainSwiping) return;
    isMainSwiping = false;

    const dx = e.changedTouches[0].clientX - mainTouchStartX;
    const dy = e.changedTouches[0].clientY - mainTouchStartY;

    // 애니메이션 복구
    booksList.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        const currentIndex = TESTAMENTS_ORDER.indexOf(state.currentTestament);
        let nextIndex = currentIndex;
        let direction = '';

        if (dx < 0 && currentIndex < TESTAMENTS_ORDER.length - 1) {
            nextIndex = currentIndex + 1; // 왼쪽으로 스와이프 -> 다음 탭
            direction = 'next';
        } else if (dx > 0 && currentIndex > 0) {
            nextIndex = currentIndex - 1; // 오른쪽으로 스와이프 -> 이전 탭
            direction = 'prev';
        }

        if (nextIndex !== currentIndex) {
            const tabBtn = document.querySelector(`.tab-btn[data-testament="${TESTAMENTS_ORDER[nextIndex]}"]`);
            if (tabBtn) {
                // 완전히 화면 밖으로 날려보내기
                const screenWidth = window.innerWidth;
                booksList.style.transform = `translateX(${direction === 'next' ? -screenWidth : screenWidth}px)`;
                booksList.style.opacity = '0';

                setTimeout(() => {
                    tabBtn.click(); // 실제 탭 클릭해서 컨텐츠 렌더링

                    // 반대쪽 끝으로 위치 초기화 (트랜지션 없이)
                    booksList.style.transition = 'none';
                    booksList.style.transform = `translateX(${direction === 'next' ? screenWidth : -screenWidth}px)`;

                    // 리플로우(Reflow) 강제 발생 - 그래야 위치 초기화가 즉시 적용됨
                    void booksList.offsetWidth;

                    // 제자리로 돌아오는 애니메이션 적용
                    booksList.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease';
                    booksList.style.transform = 'translateX(0)';
                    booksList.style.opacity = '1';
                }, 250);
                return;
            }
        }
    }

    // 스와이프 거리가 짧거나 더 이상 넘어갈 탭이 없는 경우 제자리 탄력 복귀
    booksList.style.transform = 'translateX(0)';
    booksList.style.opacity = '1';
}, { passive: true });

// ===== Hymn Detail View Swipe Navigation =====
let hymnTouchStartX = 0;
let hymnTouchStartY = 0;
let isHymnSwiping = false;

hymnDetailView.addEventListener('touchstart', (e) => {
    // 캐러셀(하단 바) 터치 시 스와이프 방지
    if (e.target.closest('.chapter-carousel-wrap')) return;
    hymnTouchStartX = e.touches[0].clientX;
    hymnTouchStartY = e.touches[0].clientY;
    isHymnSwiping = true;
    hymnDetailContent.style.transition = 'none'; // 드래그 중 애니메이션 제거
}, { passive: true });

hymnDetailView.addEventListener('touchmove', (e) => {
    if (!isHymnSwiping) return;
    const dx = e.touches[0].clientX - hymnTouchStartX;
    const dy = e.touches[0].clientY - hymnTouchStartY;

    // 수평 이동거리 위주일 때만 좌우로 움직이기
    if (Math.abs(dx) > Math.abs(dy)) {
        // 첫 장에서 우측 스와이프나 마지막 장에서 좌측 스와이프 시 텐션(저항) 추가
        if ((state.currentHymn === 1 && dx > 0) || (state.currentHymn === state.totalHymns && dx < 0)) {
            hymnDetailContent.style.transform = `translateX(${dx * 0.3}px)`; // 덜 밀림
        } else {
            hymnDetailContent.style.transform = `translateX(${dx}px)`;
            hymnDetailContent.style.opacity = `${1 - Math.abs(dx) / (window.innerWidth * 1.5)}`;
        }
    }
}, { passive: true });

hymnDetailView.addEventListener('touchend', (e) => {
    if (!isHymnSwiping) return;
    isHymnSwiping = false;

    const dx = e.changedTouches[0].clientX - hymnTouchStartX;
    const dy = e.changedTouches[0].clientY - hymnTouchStartY;

    hymnDetailContent.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        if (dx < 0 && state.currentHymn < state.totalHymns) {
            // 왼쪽 스와이프 -> 다음 찬송가
            hymnDetailContent.style.transform = `translateX(${-window.innerWidth}px)`;
            hymnDetailContent.style.opacity = '0';
            setTimeout(() => {
                state.currentHymn++;
                // 스와이프는 같은 레벨 내 이동 → replaceState
                loadHymnDetail(state.currentHymn, 'replace');
            }, 250);
            return;
        } else if (dx > 0 && state.currentHymn > 1) {
            // 오른쪽 스와이프 -> 이전 찬송가
            hymnDetailContent.style.transform = `translateX(${window.innerWidth}px)`;
            hymnDetailContent.style.opacity = '0';
            setTimeout(() => {
                state.currentHymn--;
                // 스와이프는 같은 레벨 내 이동 → replaceState
                loadHymnDetail(state.currentHymn, 'replace');
            }, 250);
            return;
        }
    }

    // 제자리 복귀
    hymnDetailContent.style.transform = 'translateX(0)';
    hymnDetailContent.style.opacity = '1';
}, { passive: true });

// ===== Verse Selection =====
function toggleVerse(verseNum) {
    if (state.selectedVerses.has(verseNum)) {
        state.selectedVerses.delete(verseNum);
    } else {
        state.selectedVerses.add(verseNum);
    }
    updateSelection();
}

function clearSelection() {
    state.selectedVerses.clear();
    updateSelection();
}

function updateSelection() {
    versesContent.querySelectorAll('.verse-item').forEach(item => {
        const num = parseInt(item.dataset.verse);
        item.classList.toggle('selected', state.selectedVerses.has(num));
    });

    if (state.selectedVerses.size > 0) {
        showFab();
    } else {
        hideFab();
    }
}

// ===== FAB =====
function showFab() {
    shareFab.classList.remove('hidden', 'hide');
    shareFab.classList.add('show');
}

function hideFab() {
    if (shareFab.classList.contains('show')) {
        shareFab.classList.remove('show');
        shareFab.classList.add('hide');
        shareFab.addEventListener('animationend', () => {
            if (shareFab.classList.contains('hide')) {
                shareFab.classList.add('hidden');
                shareFab.classList.remove('hide');
            }
        }, { once: true });
    }
}

// ===== Share =====
shareFab.addEventListener('click', async () => {
    const shareText = buildShareText();
    if (!shareText) return;

    if (navigator.share) {
        try {
            await navigator.share({ text: shareText });
        } catch (err) {
            if (err.name !== 'AbortError') {
                copyToClipboard(shareText);
            }
        }
    } else {
        copyToClipboard(shareText);
    }
});

function buildShareText() {
    const sorted = [...state.selectedVerses].sort((a, b) => a - b);
    if (sorted.length === 0) return '';

    const bookName = state.currentBook.bookName;
    const chapter = state.currentChapter;

    // 구절 범위 문자열 생성
    let verseRange = '';
    if (sorted.length === 1) {
        verseRange = `${sorted[0]}`;
    } else {
        // 연속 구절인지 확인
        const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
        if (isConsecutive) {
            verseRange = `${sorted[0]}-${sorted[sorted.length - 1]}`;
        } else {
            verseRange = sorted.join(', ');
        }
    }

    const header = `${bookName} ${chapter}:${verseRange}`;
    const body = sorted.map(num => {
        const verse = state.verses.find(v => v.verse === num);
        return verse ? verse.content : '';
    }).join('\n');

    return `${header}\n${body}`;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('클립보드에 복사되었습니다');
    }).catch(() => {
        // fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('클립보드에 복사되었습니다');
    });
}

// ===== Toast =====
let toastTimer;
function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove('hidden');
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
}

// ===== Click outside to deselect =====
document.addEventListener('click', (e) => {
    if (versesView.classList.contains('active') &&
        !e.target.closest('.verse-item') &&
        !e.target.closest('.fab')) {
        clearSelection();
    }
});

// ===== Settings Panel =====
const settingsBtn = $('#settings-btn');
const settingsPanel = $('#settings-panel');
const settingsOverlay = $('#settings-overlay');
const settingsClose = $('#settings-close');
const themeToggle = $('#theme-toggle');
const boldToggle = $('#bold-toggle');
const bottomAlignToggle = $('#bottom-align-toggle');
const fontSizeUp = $('#font-size-up');
const fontSizeDown = $('#font-size-down');
const fontSizeValue = $('#font-size-value');
const fontFamilyOptions = $('#font-family-options');

const FONT_MAP = {
    serif: "'Noto Serif KR', serif",
    sans: "'Noto Sans KR', sans-serif",
    pretendard: "'Pretendard', 'Noto Sans KR', sans-serif",
};

const settings = {
    theme: localStorage.getItem('bible-theme') || 'dark',
    fontSize: parseInt(localStorage.getItem('bible-fontSize')) || 16,
    bold: localStorage.getItem('bible-bold') === 'true',
    fontFamily: localStorage.getItem('bible-fontFamily') || 'serif',
    bottomAlign: localStorage.getItem('bible-bottomAlign') === 'true',
};

function applySettings() {
    // Theme
    document.documentElement.setAttribute('data-theme', settings.theme);
    themeToggle.classList.toggle('active', settings.theme === 'dark');

    // Font size
    versesContent.style.fontSize = settings.fontSize + 'px';
    fontSizeValue.textContent = settings.fontSize;

    // Bold
    versesContent.style.fontWeight = settings.bold ? '700' : '400';
    boldToggle.classList.toggle('active', settings.bold);

    // Font family
    versesContent.style.fontFamily = FONT_MAP[settings.fontFamily];
    fontFamilyOptions.querySelectorAll('.font-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.font === settings.fontFamily);
    });

    // Bottom align
    document.documentElement.setAttribute('data-bottom-align', settings.bottomAlign);
    bottomAlignToggle.classList.toggle('active', settings.bottomAlign);
}

function saveSettings() {
    localStorage.setItem('bible-theme', settings.theme);
    localStorage.setItem('bible-fontSize', settings.fontSize);
    localStorage.setItem('bible-bold', settings.bold);
    localStorage.setItem('bible-fontFamily', settings.fontFamily);
    localStorage.setItem('bible-bottomAlign', settings.bottomAlign);
}

// Open / Close
function openSettings() {
    settingsPanel.classList.remove('hidden');
    settingsOverlay.classList.remove('hidden');
}
function closeSettings() {
    settingsPanel.classList.add('hidden');
    settingsOverlay.classList.add('hidden');
}

settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (settingsPanel.classList.contains('hidden')) {
        openSettings();
    } else {
        closeSettings();
    }
});
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

// Theme toggle
themeToggle.addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    applySettings();
    saveSettings();
});

// Font size
fontSizeUp.addEventListener('click', () => {
    if (settings.fontSize < 24) {
        settings.fontSize += 1;
        applySettings();
        saveSettings();
    }
});
fontSizeDown.addEventListener('click', () => {
    if (settings.fontSize > 12) {
        settings.fontSize -= 1;
        applySettings();
        saveSettings();
    }
});

// Bold toggle
boldToggle.addEventListener('click', () => {
    settings.bold = !settings.bold;
    applySettings();
    saveSettings();
});

// Font family
fontFamilyOptions.querySelectorAll('.font-option').forEach(btn => {
    btn.addEventListener('click', () => {
        settings.fontFamily = btn.dataset.font;
        applySettings();
        saveSettings();
    });
});

// Bottom align toggle
bottomAlignToggle.addEventListener('click', () => {
    settings.bottomAlign = !settings.bottomAlign;
    applySettings();
    saveSettings();
});

// ===== 찬송가 목록 뷰 =====
async function loadHymnsView(historyAction = 'push') {
    navigateTo('hymns', historyAction);
    hymnsGrid.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        if (state.hymns.length === 0) {
            state.hymns = await fetchJSON('/api/hymns');
            state.totalHymns = state.hymns.length;
        }
        renderHymnsInHymnsView();
    } catch (err) {
        hymnsGrid.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

function renderHymnsInHymnsView() {
    hymnsGrid.innerHTML = `
        <div class="hymn-search-wrap">
            <input type="text" inputmode="numeric" pattern="[0-9]*" id="hymn-search" class="hymn-search" placeholder="장 번호 검색 (1~645)">
        </div>
        <div id="hymn-grid" class="hymn-grid-inner"></div>
    `;

    const searchInput = document.getElementById('hymn-search');
    const hymnGrid = document.getElementById('hymn-grid');

    updateHymnGrid(hymnGrid, state.hymns);

    searchInput.addEventListener('input', () => {
        const val = searchInput.value.trim();
        const filtered = val
            ? state.hymns.filter(h => String(h.chapter).includes(val))
            : state.hymns;
        updateHymnGrid(hymnGrid, filtered);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const num = parseInt(searchInput.value);
            if (num >= 1 && num <= 645) {
                state.currentHymn = num;
                loadHymnDetail(num);
            }
        }
    });
}

function updateHymnGrid(container, hymns) {
    container.innerHTML = hymns.map(h => `
        <button class="hymn-btn" data-chapter="${h.chapter}">${h.chapter}</button>
    `).join('');

    container.querySelectorAll('.hymn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentHymn = parseInt(btn.dataset.chapter);
            loadHymnDetail(state.currentHymn);
        });
    });
}

async function loadHymnDetail(chapter, historyAction = 'push') {
    navigateTo('hymnDetail', historyAction);

    // 전환 애니메이션 스타일 초기화
    hymnDetailContent.style.transition = 'none';
    hymnDetailContent.style.transform = 'translateX(0)';
    hymnDetailContent.style.opacity = '1';

    // 로딩 UI 표시 (이전 악보는 지워집니다)
    hymnDetailContent.innerHTML = '<div class="loader" id="hymn-loader">불러오는 중...</div>';

    try {
        const hymn = await fetchJSON(`/api/hymns/${chapter}`);

        // 화면 하단 캐러셀은 즉시 렌더링 (이미지 로딩 대기 중에도 다른 장으로 이동 가능하도록)
        renderHymnCarousel();
        window.scrollTo({ top: 0 });

        // 브라우저 DOM 캐싱 버그를 피하기 위해 메모리 객체로 이미지 다운로드 (Preloading)
        const newImg = new Image();
        newImg.className = 'hymn-sheet-img';
        newImg.alt = `찬송가 ${chapter}장 악보`;

        newImg.onload = () => {
            // 사용자가 그 사이 다른 찬송가로 넘기지 않았을 때만 화면에 부착 (Race condition 방지)
            if (state.currentHymn === chapter) {
                hymnDetailContent.innerHTML = '';
                hymnDetailContent.appendChild(newImg);
            }
        };

        newImg.onerror = () => {
            if (state.currentHymn === chapter) {
                if (!newImg.src.includes('?retry=')) {
                    // 첫 실패 시 브라우저 강제 캐시 무시를 위해 쿼리 파라미터 추가
                    newImg.src = `${hymn.downloadUrl}?retry=${Date.now()}`;
                } else {
                    hymnDetailContent.innerHTML = '<div class="loader" style="color:red;">이미지를 불러오지 못했습니다.</div>';
                }
            }
        };

        // 로딩 트리거 시작
        newImg.src = hymn.downloadUrl;

    } catch (err) {
        hymnDetailContent.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

function renderHymnCarousel() {
    const total = state.totalHymns;
    const current = state.currentHymn;

    hymnCarousel.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-carousel-btn' + (i === current ? ' active' : '');
        btn.textContent = i;
        btn.dataset.chapter = i;
        btn.addEventListener('click', () => {
            if (i === state.currentHymn) return;
            state.currentHymn = i;
            // 캐러셀은 같은 레벨 내 이동 → replaceState
            loadHymnDetail(i, 'replace');
        });
        hymnCarousel.appendChild(btn);
    }

    // 현재 장을 가운데로 스크롤
    requestAnimationFrame(() => {
        const activeBtn = hymnCarousel.querySelector('.chapter-carousel-btn.active');
        if (!activeBtn) return;
        const containerWidth = hymnCarousel.offsetWidth;
        hymnCarousel.scrollTo({
            left: activeBtn.offsetLeft - containerWidth / 2 + activeBtn.offsetWidth / 2,
            behavior: 'smooth'
        });
    });
}

// ===== Init =====
async function handleInitialRoute() {
    const hash = location.hash.slice(1); // '#' 제거

    const versesMatch = hash.match(/^book\/(\d+)\/chapter\/(\d+)$/);
    const chaptersMatch = hash.match(/^book\/(\d+)$/);
    const hymnMatch = hash.match(/^hymn\/(\d+)$/);
    const hymnsListMatch = hash === 'hymns';

    if (versesMatch) {
        // 특정 구절 뷰로 직접 진입
        const bookIndex = parseInt(versesMatch[1]);
        const chapter = parseInt(versesMatch[2]);
        state.books = await fetchJSON('/api/books').catch(() => []);
        state.currentBook = state.books.find(b => b.bookIndex === bookIndex);
        if (!state.currentBook) { return handleInitialRoute._fallback(); }
        state.currentChapter = chapter;
        const chapters = await fetchJSON(`/api/books/${bookIndex}/chapters`).catch(() => []);
        state.totalChapters = chapters.length;
        history.replaceState(
            { view: 'verses', bookIndex, chapter, totalChapters: state.totalChapters },
            '', `#${hash}`
        );
        await loadVerses(bookIndex, chapter, null, 'skip');

    } else if (chaptersMatch) {
        // 특정 책의 장 선택 뷰로 직접 진입
        const bookIndex = parseInt(chaptersMatch[1]);
        state.books = await fetchJSON('/api/books').catch(() => []);
        state.currentBook = state.books.find(b => b.bookIndex === bookIndex);
        if (!state.currentBook) { return handleInitialRoute._fallback(); }
        history.replaceState({ view: 'chapters', bookIndex }, '', `#${hash}`);
        await loadChapters(bookIndex, 'skip');

    } else if (hymnsListMatch) {
        // 찬송가 목록 뷰로 직접 진입
        history.replaceState({ view: 'hymns' }, '', '#hymns');
        fetchJSON('/api/books').then(books => { state.books = books; }).catch(() => {});
        await loadHymnsView('skip');

    } else if (hymnMatch) {
        // 특정 찬송가 뷰로 직접 진입
        const hymn = parseInt(hymnMatch[1]);
        state.currentHymn = hymn;
        history.replaceState({ view: 'hymnDetail', hymn }, '', `#${hash}`);
        if (state.hymns.length === 0) {
            state.hymns = await fetchJSON('/api/hymns').catch(() => []);
            state.totalHymns = state.hymns.length;
        }
        await loadHymnDetail(hymn, 'skip');
        fetchJSON('/api/books').then(books => { state.books = books; }).catch(() => {});

    } else {
        // 기본: 책 목록 뷰 (탭 해시 지원, Hymn 탭은 hymns-view로 리다이렉트)
        const testament = hash.startsWith('tab/') ? hash.slice(4) : 'Old';
        const validTestament = ['Old', 'New'].includes(testament) ? testament : 'Old';
        state.currentTestament = validTestament;
        history.replaceState({ view: 'books', testament: validTestament }, '', `#tab/${validTestament}`);
        await loadBooks();
        if (validTestament !== 'Old') {
            navigateTo('books', 'skip');
        }
    }
}

handleInitialRoute._fallback = async () => {
    state.currentTestament = 'Old';
    history.replaceState({ view: 'books', testament: 'Old' }, '', '#tab/Old');
    await loadBooks();
};

applySettings();
handleInitialRoute();
