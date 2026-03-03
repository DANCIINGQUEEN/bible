// ===== 구절 읽기 페이지 (verses.html?book=X&chapter=Y) =====

const params = new URLSearchParams(location.search);
const bookIndex = parseInt(params.get('book'));
let currentChapter = parseInt(params.get('chapter'));

// 잘못된 파라미터면 홈으로
if (!bookIndex || bookIndex < 1 || bookIndex > 66 || !currentChapter || currentChapter < 1) {
    window.location.replace('/');
}

const headerTitle = document.getElementById('header-title');
const versesContent = document.getElementById('verses-content');
const chapterCarouselWrap = document.getElementById('chapter-carousel-wrap');
const chapterCarousel = document.getElementById('chapter-carousel');
const prevChapterBtn = document.getElementById('prev-chapter');
const nextChapterBtn = document.getElementById('next-chapter');
const prevLabel = document.getElementById('prev-label');
const nextLabel = document.getElementById('next-label');
const chapterIndicator = document.getElementById('chapter-indicator');
const shareFab = document.getElementById('share-fab');

let bookName = '';
let totalChapters = 0;
let verses = [];
let selectedVerses = new Set();
const versesCache = {};

// ===== 뒤로가기 =====
document.getElementById('back-btn').addEventListener('click', () => {
    history.back();
});

// ===== 초기화 =====
async function init() {
    initSettingsPanel(versesContent);

    try {
        const [books, chapters] = await Promise.all([
            fetchJSON('/api/books'),
            fetchJSON(`/api/books/${bookIndex}/chapters`),
        ]);

        const book = books.find(b => b.bookIndex === bookIndex);
        if (!book) { window.location.replace('/'); return; }

        bookName = book.bookName;
        totalChapters = chapters.length;

        // chapter 범위 검증
        if (currentChapter > totalChapters) currentChapter = totalChapters;

        await loadVerses(currentChapter, null);
    } catch (err) {
        versesContent.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

// ===== 구절 로드 =====
async function loadVerses(chapter, direction) {
    // URL + 헤더 업데이트
    currentChapter = chapter;
    headerTitle.textContent = `${bookName} ${chapter}장`;
    document.title = `${bookName} ${chapter}장 | 개역개정 성경`;
    history.replaceState(null, '', `/verses.html?book=${bookIndex}&chapter=${chapter}`);

    // 슬라이드 애니메이션
    if (direction) {
        const slideOut = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
        const slideIn = direction === 'next' ? 'slide-in-right' : 'slide-in-left';
        versesContent.classList.add(slideOut);
        await new Promise(r => setTimeout(r, 200));
        versesContent.classList.remove(slideOut);
        versesContent.classList.add(slideIn);
        setTimeout(() => versesContent.classList.remove(slideIn), 300);
    }

    const cacheKey = `${bookIndex}-${chapter}`;

    if (versesCache[cacheKey]) {
        verses = versesCache[cacheKey];
        renderVerses();
    } else {
        versesContent.innerHTML = '<div class="loader">불러오는 중...</div>';
        try {
            verses = await fetchJSON(`/api/books/${bookIndex}/chapters/${chapter}`);
            versesCache[cacheKey] = verses;
            renderVerses();
        } catch (err) {
            versesContent.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
        }
    }

    clearSelection();
    updateChapterNav();
    window.scrollTo({ top: 0 });

    // 인접 장 프리페치
    prefetchChapter(chapter - 1);
    prefetchChapter(chapter + 1);
}

async function prefetchChapter(chapter) {
    if (chapter < 1 || chapter > totalChapters) return;
    const cacheKey = `${bookIndex}-${chapter}`;
    if (versesCache[cacheKey]) return;
    try {
        versesCache[cacheKey] = await fetchJSON(`/api/books/${bookIndex}/chapters/${chapter}`);
    } catch (e) { /* 프리페치 실패 무시 */ }
}

// ===== 구절 렌더링 =====
function renderVerses() {
    let html = '';
    let lastHeadline = null;
    verses.forEach(v => {
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
        item.addEventListener('click', e => {
            e.stopPropagation();
            toggleVerse(parseInt(item.dataset.verse));
        });
    });
}

// ===== 장 이동 =====
function goToChapter(direction) {
    const delta = direction === 'next' ? 1 : -1;
    const next = currentChapter + delta;
    if (next < 1 || next > totalChapters) return;
    loadVerses(next, direction);
}

document.getElementById('prev-chapter').addEventListener('click', () => goToChapter('prev'));
document.getElementById('next-chapter').addEventListener('click', () => goToChapter('next'));

// ===== 장 네비게이션 UI =====
function updateChapterNav() {
    prevChapterBtn.disabled = currentChapter <= 1;
    nextChapterBtn.disabled = currentChapter >= totalChapters;
    prevLabel.textContent = currentChapter > 1 ? `${currentChapter - 1}장` : '이전';
    nextLabel.textContent = currentChapter < totalChapters ? `${currentChapter + 1}장` : '다음';
    chapterIndicator.textContent = `${currentChapter} / ${totalChapters}`;

    if (chapterCarousel.children.length !== totalChapters) {
        renderChapterCarousel();
    } else {
        updateCarouselActive();
    }
}

// ===== 캐러셀 =====
function renderChapterCarousel() {
    chapterCarousel.innerHTML = '';
    for (let i = 1; i <= totalChapters; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-carousel-btn' + (i === currentChapter ? ' active' : '');
        btn.textContent = i;
        btn.dataset.chapter = i;
        btn.addEventListener('click', () => {
            if (i === currentChapter) return;
            const dir = i > currentChapter ? 'next' : 'prev';
            loadVerses(i, dir);
        });
        chapterCarousel.appendChild(btn);
    }
    scrollCarouselToCenter(currentChapter);
}

function updateCarouselActive() {
    chapterCarousel.querySelectorAll('.chapter-carousel-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.chapter) === currentChapter);
    });
    scrollCarouselToCenter(currentChapter);
}

function scrollCarouselToCenter(chapter) {
    requestAnimationFrame(() => {
        const activeBtn = chapterCarousel.querySelector('.chapter-carousel-btn.active') ||
            chapterCarousel.children[chapter - 1];
        if (!activeBtn) return;
        chapterCarousel.scrollTo({
            left: activeBtn.offsetLeft - chapterCarousel.offsetWidth / 2 + activeBtn.offsetWidth / 2,
            behavior: 'smooth',
        });
    });
}

// ===== 스크롤 시 캐러셀 숨기기 =====
let lastScrollY = 0;
let carouselHidden = false;

window.addEventListener('scroll', () => {
    const delta = window.scrollY - lastScrollY;
    if (delta > 5 && !carouselHidden) {
        chapterCarouselWrap.classList.add('carousel-hidden');
        carouselHidden = true;
    } else if (delta < -5 && carouselHidden) {
        chapterCarouselWrap.classList.remove('carousel-hidden');
        carouselHidden = false;
    }
    lastScrollY = window.scrollY;
}, { passive: true });

// ===== 스와이프 제스처 =====
let touchStartX = 0;
let touchStartY = 0;
let touchOnCarousel = false;

document.getElementById('main').addEventListener('touchstart', (e) => {
    touchOnCarousel = e.target.closest('.chapter-carousel-wrap') !== null;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.getElementById('main').addEventListener('touchend', (e) => {
    if (touchOnCarousel) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        goToChapter(dx < 0 ? 'next' : 'prev');
    }
}, { passive: true });

// ===== 구절 선택 =====
function toggleVerse(verseNum) {
    if (selectedVerses.has(verseNum)) {
        selectedVerses.delete(verseNum);
    } else {
        selectedVerses.add(verseNum);
    }
    updateSelection();
}

function clearSelection() {
    selectedVerses.clear();
    updateSelection();
}

function updateSelection() {
    versesContent.querySelectorAll('.verse-item').forEach(item => {
        item.classList.toggle('selected', selectedVerses.has(parseInt(item.dataset.verse)));
    });
    selectedVerses.size > 0 ? showFab() : hideFab();
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.verse-item') && !e.target.closest('.fab')) {
        clearSelection();
    }
});

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

// ===== 공유 =====
shareFab.addEventListener('click', async () => {
    const text = buildShareText();
    if (!text) return;
    if (navigator.share) {
        try { await navigator.share({ text }); }
        catch (err) { if (err.name !== 'AbortError') copyToClipboard(text); }
    } else {
        copyToClipboard(text);
    }
});

function buildShareText() {
    const sorted = [...selectedVerses].sort((a, b) => a - b);
    if (sorted.length === 0) return '';
    let range = '';
    if (sorted.length === 1) {
        range = `${sorted[0]}`;
    } else {
        const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
        range = isConsecutive ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(', ');
    }
    const header = `${bookName} ${currentChapter}:${range}`;
    const body = sorted.map(num => {
        const v = verses.find(v => v.verse === num);
        return v ? v.content : '';
    }).join('\n');
    return `${header}\n${body}`;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('클립보드에 복사되었습니다');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('클립보드에 복사되었습니다');
    });
}

// ===== 실행 =====
init();
