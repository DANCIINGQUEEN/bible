// ===== 장 선택 페이지 (chapters.html?book=X) =====

const params = new URLSearchParams(location.search);
const bookIndex = parseInt(params.get('book'));

const headerTitle = document.getElementById('header-title');
const chaptersGrid = document.getElementById('chapters-grid');

// 잘못된 파라미터면 홈으로
if (!bookIndex || bookIndex < 1 || bookIndex > 66) {
    window.location.replace('/');
}

// ===== 뒤로가기 =====
document.getElementById('back-btn').addEventListener('click', () => {
    history.back();
});

// ===== 초기화 =====
async function init() {
    initSettingsPanel(null);

    chaptersGrid.innerHTML = '<div class="loader">불러오는 중...</div>';

    try {
        // 책 정보 + 장 목록 병렬 로드
        const [books, chapters] = await Promise.all([
            fetchJSON('/api/books'),
            fetchJSON(`/api/books/${bookIndex}/chapters`),
        ]);

        const book = books.find(b => b.bookIndex === bookIndex);
        if (!book) { window.location.replace('/'); return; }

        headerTitle.textContent = book.bookName;
        document.title = `${book.bookName} | 개역개정 성경`;

        chaptersGrid.innerHTML = chapters.map(c => `
            <button class="chapter-btn" data-chapter="${c.chapter}">${c.chapter}</button>
        `).join('');

        chaptersGrid.querySelectorAll('.chapter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = `/verses.html?book=${bookIndex}&chapter=${btn.dataset.chapter}`;
            });
        });

    } catch (err) {
        chaptersGrid.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

init();
