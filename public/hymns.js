// ===== 찬송가 목록 페이지 (hymns.html) =====

const hymnGrid = document.getElementById('hymn-grid');
const hymnSearch = document.getElementById('hymn-search');
let hymns = [];

// ===== 뒤로가기 =====
document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = '/';
});

// ===== 초기화 =====
async function init() {
    initSettingsPanel(null);

    hymnGrid.innerHTML = '<div class="loader">불러오는 중...</div>';
    try {
        hymns = await fetchJSON('/api/hymns');
        renderGrid(hymns);
    } catch (err) {
        hymnGrid.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
    }
}

// ===== 그리드 렌더링 =====
function renderGrid(list) {
    hymnGrid.innerHTML = list.map(h => `
        <button class="hymn-btn" data-chapter="${h.chapter}">${h.chapter}</button>
    `).join('');

    hymnGrid.querySelectorAll('.hymn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `/hymn.html?chapter=${btn.dataset.chapter}`;
        });
    });
}

// ===== 검색 =====
hymnSearch.addEventListener('input', () => {
    const val = hymnSearch.value.trim();
    const filtered = val ? hymns.filter(h => String(h.chapter).includes(val)) : hymns;
    renderGrid(filtered);
});

hymnSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const num = parseInt(hymnSearch.value);
        if (num >= 1 && num <= 645) {
            window.location.href = `/hymn.html?chapter=${num}`;
        }
    }
});

// ===== 실행 =====
init();
