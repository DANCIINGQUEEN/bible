// ===== State =====
const state = {
    books: [],
    currentTestament: 'Old',
    currentBook: null,
    currentChapter: null,
    verses: [],
    selectedVerses: new Set(),
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

// ===== API =====
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ===== Views =====
function showView(viewId) {
    [booksView, chaptersView, versesView].forEach(v => v.classList.remove('active'));
    $(viewId).classList.add('active');
}

function navigateTo(view) {
    clearSelection();
    if (view === 'books') {
        showView('#books-view');
        headerTitle.textContent = '개역개정 성경';
        backBtn.classList.add('hidden');
        state.currentBook = null;
        state.currentChapter = null;
    } else if (view === 'chapters') {
        showView('#chapters-view');
        headerTitle.textContent = state.currentBook.bookName;
        backBtn.classList.remove('hidden');
    } else if (view === 'verses') {
        showView('#verses-view');
        headerTitle.textContent = `${state.currentBook.bookName} ${state.currentChapter}장`;
        backBtn.classList.remove('hidden');
    }
}

// ===== Back Navigation =====
backBtn.addEventListener('click', () => {
    if (versesView.classList.contains('active')) {
        navigateTo('chapters');
    } else if (chaptersView.classList.contains('active')) {
        navigateTo('books');
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
        renderBooks();
    });
});

// ===== Load Chapters =====
async function loadChapters(bookIndex) {
    navigateTo('chapters');
    chaptersGrid.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        const chapters = await fetchJSON(`/api/books/${bookIndex}/chapters`);
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
async function loadVerses(bookIndex, chapter) {
    navigateTo('verses');
    versesContent.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        state.verses = await fetchJSON(`/api/books/${bookIndex}/chapters/${chapter}`);
        renderVerses();
    } catch (err) {
        versesContent.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
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

// ===== Theme Toggle =====
const themeToggle = $('#theme-toggle');

function initTheme() {
    const saved = localStorage.getItem('bible-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
    // 저장값 없으면 다크(기본)
}

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('bible-theme', next);
});

// ===== Init =====
initTheme();
loadBooks();
