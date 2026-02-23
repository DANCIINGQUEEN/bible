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

// ===== History Navigation (Back/Forward) =====
function pushHistoryState(view) {
    // 현재 상태와 동일한 뷰로 이동하는 거라면 저장하지 않음
    if (history.state && history.state.view === view) return;

    const stateObj = {
        view: view,
        testament: state.currentTestament,
        bookIndex: state.currentBook ? state.currentBook.bookIndex : null,
        chapter: state.currentChapter,
        hymn: state.currentHymn
    };
    history.pushState(stateObj, '', '');
}

window.addEventListener('popstate', (e) => {
    // 설정 창이 열려있다면 설정 창만 닫고 종료
    if (!settingsPanel.classList.contains('hidden')) {
        closeSettings();
        // 설정 창을 닫은 상태를 유지하기 위해 다시 현재 상태를 push (보정)
        history.pushState(e.state, '', '');
        return;
    }

    if (e.state && e.state.view) {
        // 이전 상태 복원
        state.currentTestament = e.state.testament || 'Old';
        state.currentChapter = e.state.chapter || null;
        state.currentHymn = e.state.hymn || null;

        if (e.state.bookIndex && state.books.length > 0) {
            state.currentBook = state.books.find(b => b.bookIndex === e.state.bookIndex);
        }

        navigateTo(e.state.view, true); // true 플래그로 history.pushState 방지
    } else {
        // 기본 상태 (브라우저 진입 초기)
        navigateTo('books', true);
    }
});

// ===== Views =====
function showView(viewId) {
    [booksView, chaptersView, versesView, hymnsView, hymnDetailView].forEach(v => v.classList.remove('active'));
    $(viewId).classList.add('active');
}

function navigateTo(view, isPopState = false) {
    clearSelection();
    // 기본적으로 캐러셀 숨기기
    chapterCarouselWrap.classList.add('hidden');
    hymnCarouselWrap.classList.add('hidden');

    if (!isPopState) {
        pushHistoryState(view);
    }

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

        if (state.currentTestament === 'Hymn') {
            booksList.classList.add('hymn-mode');
            if (state.hymns.length === 0) loadHymnsData();
            else renderHymnsInBooksList();
        } else {
            booksList.classList.remove('hymn-mode');
            if (state.books.length > 0) renderBooks();
        }
    } else if (view === 'chapters') {
        showView('#chapters-view');
        headerTitle.textContent = state.currentBook ? state.currentBook.bookName : '장 선택';
        backBtn.classList.remove('hidden');
        if (state.currentBook) loadChapters(state.currentBook.bookIndex, true); // true 플래그로 중복 탐색 방지
    } else if (view === 'verses') {
        showView('#verses-view');
        headerTitle.textContent = `${state.currentBook ? state.currentBook.bookName : ''} ${state.currentChapter || ''}장`;
        backBtn.classList.remove('hidden');
        chapterCarouselWrap.classList.remove('hidden');
        chapterCarouselWrap.classList.remove('carousel-hidden');
        carouselHidden = false;
        lastScrollY = 0;
        if (state.currentBook && state.currentChapter) {
            loadVerses(state.currentBook.bookIndex, state.currentChapter, null, true);
        }
    } else if (view === 'hymnDetail') {
        showView('#hymn-detail-view');
        headerTitle.textContent = `찬송가 ${state.currentHymn || ''}장`;
        backBtn.classList.remove('hidden');
        hymnCarouselWrap.classList.remove('hidden');
        hymnCarouselWrap.classList.remove('carousel-hidden');
        carouselHidden = false;
        lastScrollY = 0;
        if (state.currentHymn) loadHymnDetail(state.currentHymn, true);
    }
}

// ===== Back Navigation (UI Button) =====
backBtn.addEventListener('click', () => {
    // UI의 뒤로가기 버튼을 누르면 브라우저 히스토리 백을 트리거 (일관성 유지)
    history.back();
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
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTestament = btn.dataset.testament;
        if (btn.dataset.testament === 'Hymn') {
            booksList.classList.add('hymn-mode');
            loadHymnsData();
        } else {
            booksList.classList.remove('hymn-mode');
            renderBooks();
        }
    });
});

// ===== Load Chapters =====
async function loadChapters(bookIndex, isPopState = false) {
    navigateTo('chapters', isPopState);
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

async function loadVerses(bookIndex, chapter, direction, isPopState = false) {
    navigateTo('verses', isPopState);

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
    loadVerses(state.currentBook.bookIndex, state.currentChapter, direction);
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
            loadVerses(state.currentBook.bookIndex, i, dir);
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

// ===== 찬송가 =====
async function loadHymnsData() {
    booksList.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        if (state.hymns.length === 0) {
            state.hymns = await fetchJSON('/api/hymns');
            state.totalHymns = state.hymns.length;
        }
        renderHymnsInBooksList();
    } catch (err) {
        booksList.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

function renderHymnsInBooksList() {
    booksList.classList.remove('hymn-mode');
    booksList.classList.remove('books-grid');

    // 검색바 + 그리드 컨테이너 구성 (1회만)
    booksList.innerHTML = `
        <div class="hymn-search-wrap">
            <input type="text" inputmode="numeric" pattern="[0-9]*" id="hymn-search" class="hymn-search" placeholder="장 번호 검색 (1~645)">
        </div>
        <div id="hymn-grid" class="hymn-grid-inner"></div>
    `;

    const searchInput = document.getElementById('hymn-search');
    const hymnGrid = document.getElementById('hymn-grid');

    // 초기 전체 렌더
    updateHymnGrid(hymnGrid, state.hymns);

    // 입력 이벤트 → 그리드만 업데이트
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

async function loadHymnDetail(chapter, isPopState = false) {
    navigateTo('hymnDetail', isPopState);
    hymnDetailContent.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        const hymn = await fetchJSON(`/api/hymns/${chapter}`);
        hymnDetailContent.innerHTML = `
            <img src="${hymn.downloadUrl}" alt="찬송가 ${chapter}장 악보" class="hymn-sheet-img" loading="lazy">
        `;
        renderHymnCarousel();
        window.scrollTo({ top: 0 });
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
            loadHymnDetail(i);
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
applySettings();
loadBooks();
