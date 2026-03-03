// ===== 책 목록 페이지 (index.html) =====

const booksList = document.getElementById('books-list');
const TESTAMENTS_ORDER = ['Old', 'New', 'Hymn'];

let currentTestament = 'Old';
let books = [];

// ===== 초기화 =====
async function init() {
    initSettingsPanel(null);

    // URL 해시에서 탭 복원
    const hash = location.hash.slice(1);
    if (hash === 'New') {
        currentTestament = 'New';
    } else {
        currentTestament = 'Old';
    }

    setActiveTab(currentTestament);

    try {
        booksList.innerHTML = '<div class="loader">불러오는 중...</div>';
        books = await fetchJSON('/api/books');
        renderBooks();
    } catch (err) {
        booksList.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
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

// ===== 탭 클릭 =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const testament = btn.dataset.testament;
        if (testament === 'Hymn') {
            window.location.href = '/hymns.html';
            return;
        }
        currentTestament = testament;
        setActiveTab(testament);
        history.replaceState(null, '', `#${testament}`);
        if (books.length > 0) renderBooks();
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
    booksList.style.transition = 'none';
}, { passive: true });

mainEl.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
        booksList.style.transform = `translateX(${dx}px)`;
        booksList.style.opacity = `${1 - Math.abs(dx) / (window.innerWidth * 1.5)}`;
    }
}, { passive: true });

mainEl.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    booksList.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';

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
            booksList.style.transform = `translateX(${direction === 'next' ? -screenWidth : screenWidth}px)`;
            booksList.style.opacity = '0';

            setTimeout(() => {
                if (nextTestament === 'Hymn') {
                    window.location.href = '/hymns.html';
                    return;
                }
                currentTestament = nextTestament;
                setActiveTab(currentTestament);
                history.replaceState(null, '', `#${currentTestament}`);

                booksList.style.transition = 'none';
                booksList.style.transform = `translateX(${direction === 'next' ? screenWidth : -screenWidth}px)`;
                void booksList.offsetWidth; // 리플로우 강제
                booksList.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease';
                booksList.style.transform = 'translateX(0)';
                booksList.style.opacity = '1';
                if (books.length > 0) renderBooks();
            }, 250);
            return;
        }
    }

    booksList.style.transform = 'translateX(0)';
    booksList.style.opacity = '1';
}, { passive: true });

// ===== 실행 =====
init();
