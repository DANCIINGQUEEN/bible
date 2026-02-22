// ===== State =====
const state = {
    books: [],
    currentTestament: 'Old',
    currentBook: null,
    currentChapter: null,
    totalChapters: 0,
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
const prevChapterBtn = $('#prev-chapter');
const nextChapterBtn = $('#next-chapter');
const prevLabel = $('#prev-label');
const nextLabel = $('#next-label');
const chapterIndicator = $('#chapter-indicator');

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
async function loadVerses(bookIndex, chapter) {
    navigateTo('verses');
    versesContent.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        state.verses = await fetchJSON(`/api/books/${bookIndex}/chapters/${chapter}`);
        renderVerses();
        updateChapterNav();
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

// ===== Chapter Navigation =====
function updateChapterNav() {
    const ch = state.currentChapter;
    const total = state.totalChapters;

    prevChapterBtn.disabled = ch <= 1;
    nextChapterBtn.disabled = ch >= total;

    prevLabel.textContent = ch > 1 ? `${ch - 1}장` : '이전';
    nextLabel.textContent = ch < total ? `${ch + 1}장` : '다음';
    chapterIndicator.textContent = `${ch} / ${total}`;
}

prevChapterBtn.addEventListener('click', () => {
    if (state.currentChapter > 1) {
        state.currentChapter -= 1;
        loadVerses(state.currentBook.bookIndex, state.currentChapter);
    }
});

nextChapterBtn.addEventListener('click', () => {
    if (state.currentChapter < state.totalChapters) {
        state.currentChapter += 1;
        loadVerses(state.currentBook.bookIndex, state.currentChapter);
    }
});

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

// ===== Init =====
applySettings();
loadBooks();
