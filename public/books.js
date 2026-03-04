// ===== 책 목록 페이지 (index.html) =====

const booksList = document.getElementById('books-list');
const hymnPanel = document.getElementById('hymn-panel');
const hymnGrid = document.getElementById('hymn-grid');
const hymnSearchInput = document.getElementById('hymn-search');
const TESTAMENTS_ORDER = ['Old', 'New', 'Hymn'];

let currentTestament = 'Old';
let books = [];
let hymns = [];
let hymnsLoaded = false;

// ===== 활성 패널 반환 =====
function getActivePanel() {
    return currentTestament === 'Hymn' ? hymnPanel : booksList;
}

// ===== 초기화 =====
async function init() {
    initSettingsPanel(null);

    // URL 해시에서 탭 복원
    const hash = location.hash.slice(1);
    if (hash === 'New') currentTestament = 'New';
    else if (hash === 'Hymn') currentTestament = 'Hymn';
    else currentTestament = 'Old';

    showPanel(currentTestament);
    setActiveTab(currentTestament);

    try {
        booksList.innerHTML = '<div class="loader">불러오는 중...</div>';
        books = await fetchJSON('/api/books');
        if (currentTestament !== 'Hymn') renderBooks();
    } catch (err) {
        booksList.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }

    if (currentTestament === 'Hymn') {
        loadHymns();
    }
}

// ===== 패널 표시/숨김 =====
function showPanel(testament) {
    const isHymn = testament === 'Hymn';
    booksList.style.display = isHymn ? 'none' : '';
    hymnPanel.style.display = isHymn ? '' : 'none';

    // 숨겨진 패널 인라인 스타일 초기화 (다음 슬라이드 인 애니메이션 대비)
    const hiddenPanel = isHymn ? booksList : hymnPanel;
    hiddenPanel.style.transform = '';
    hiddenPanel.style.opacity = '';
    hiddenPanel.style.transition = '';
}

// ===== 탭 활성화 =====
function setActiveTab(testament) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.testament === testament);
    });
}

// ===== 책 목록 렌더링 =====
function renderBooks() {
    const filtered = books.filter(b => b.testament === currentTestament);
    booksList.innerHTML = filtered.map(book => `
        <button class="book-btn" data-index="${book.bookIndex}">${book.bookName}</button>
    `).join('');

    booksList.querySelectorAll('.book-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `/chapters.html?book=${btn.dataset.index}`;
        });
    });
}

// ===== 찬송가 로드 =====
async function loadHymns() {
    if (hymnsLoaded) return;
    hymnGrid.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        hymns = await fetchJSON('/api/hymns');
        hymnsLoaded = true;
        renderHymns(hymns);
    } catch (err) {
        hymnGrid.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

// ===== 찬송가 그리드 렌더링 =====
function renderHymns(list) {
    hymnGrid.innerHTML = list.map(h => `
        <button class="hymn-btn" data-chapter="${h.chapter}">${h.chapter}</button>
    `).join('');

    hymnGrid.querySelectorAll('.hymn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `/hymn.html?chapter=${btn.dataset.chapter}`;
        });
    });
}

// ===== 찬송가 검색 =====
hymnSearchInput.addEventListener('input', () => {
    const val = hymnSearchInput.value.trim();
    const filtered = val ? hymns.filter(h => String(h.chapter).includes(val)) : hymns;
    renderHymns(filtered);
});

hymnSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const num = parseInt(hymnSearchInput.value);
        if (num >= 1 && num <= 645) {
            window.location.href = `/hymn.html?chapter=${num}`;
        }
    }
});

// ===== 탭 클릭 =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const testament = btn.dataset.testament;
        if (testament === currentTestament) return;

        currentTestament = testament;
        setActiveTab(testament);
        history.replaceState(null, '', `#${testament}`);
        showPanel(testament);

        if (testament === 'Hymn') {
            loadHymns();
        } else if (books.length > 0) {
            renderBooks();
        }
    });
});

// ===== 스와이프 제스처 (탭 간 이동) =====
const mainEl = document.getElementById('main');
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;

mainEl.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.closest('.tab-btn')) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = true;
    getActivePanel().style.transition = 'none';
}, { passive: true });

mainEl.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
        const panel = getActivePanel();
        panel.style.transform = `translateX(${dx}px)`;
        panel.style.opacity = `${1 - Math.abs(dx) / (window.innerWidth * 1.5)}`;
    }
}, { passive: true });

mainEl.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const panel = getActivePanel();
    panel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        const currentIndex = TESTAMENTS_ORDER.indexOf(currentTestament);
        let nextIndex = currentIndex;
        let direction = '';

        if (dx < 0 && currentIndex < TESTAMENTS_ORDER.length - 1) {
            nextIndex = currentIndex + 1;
            direction = 'next';
        } else if (dx > 0 && currentIndex > 0) {
            nextIndex = currentIndex - 1;
            direction = 'prev';
        }

        if (nextIndex !== currentIndex) {
            const nextTestament = TESTAMENTS_ORDER[nextIndex];
            const screenWidth = window.innerWidth;

            // 현재 패널 슬라이드 아웃
            panel.style.transform = `translateX(${direction === 'next' ? -screenWidth : screenWidth}px)`;
            panel.style.opacity = '0';

            setTimeout(() => {
                // 탭 상태 변경
                currentTestament = nextTestament;
                setActiveTab(currentTestament);
                history.replaceState(null, '', `#${currentTestament}`);

                // 패널 전환 (숨겨진 패널 스타일 초기화 포함)
                showPanel(currentTestament);

                // 콘텐츠 업데이트
                if (currentTestament === 'Hymn') {
                    loadHymns();
                } else if (books.length > 0) {
                    renderBooks();
                }

                // 새 패널 슬라이드 인
                const newPanel = getActivePanel();
                newPanel.style.transition = 'none';
                newPanel.style.transform = `translateX(${direction === 'next' ? screenWidth : -screenWidth}px)`;
                newPanel.style.opacity = '0';
                void newPanel.offsetWidth; // 리플로우 강제
                newPanel.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease';
                newPanel.style.transform = 'translateX(0)';
                newPanel.style.opacity = '1';
            }, 250);
            return;
        }
    }

    panel.style.transform = 'translateX(0)';
    panel.style.opacity = '1';
}, { passive: true });

// ===== 실행 =====
init();
