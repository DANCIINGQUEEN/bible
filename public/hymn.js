// ===== 찬송가 상세 페이지 (hymn.html?chapter=Z) =====

const params = new URLSearchParams(location.search);
let currentChapter = parseInt(params.get('chapter'));
const TOTAL_HYMNS = 645;

// 잘못된 파라미터면 목록으로
if (!currentChapter || currentChapter < 1 || currentChapter > TOTAL_HYMNS) {
    window.location.replace('/hymns.html');
}

const headerTitle = document.getElementById('header-title');
const hymnDetailContent = document.getElementById('hymn-detail-content');
const hymnCarouselWrap = document.getElementById('hymn-carousel-wrap');
const hymnCarousel = document.getElementById('hymn-carousel');

// ===== 뒤로가기 =====
document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = '/hymns.html';
});

// ===== 초기화 =====
function init() {
    initSettingsPanel(null);
    loadHymn(currentChapter);
}

// ===== 찬송가 로드 =====
async function loadHymn(chapter) {
    currentChapter = chapter;
    headerTitle.textContent = `찬송가 ${chapter}장`;
    document.title = `찬송가 ${chapter}장 | 개역개정 성경`;
    history.replaceState(null, '', `/hymn.html?chapter=${chapter}`);

    // 전환 스타일 초기화
    hymnDetailContent.style.transition = 'none';
    hymnDetailContent.style.transform = 'translateX(0)';
    hymnDetailContent.style.opacity = '1';
    hymnDetailContent.innerHTML = '<div class="loader">불러오는 중...</div>';

    // 캐러셀: 최초 1회만 생성, 이후에는 active 상태만 업데이트
    if (hymnCarousel.children.length !== TOTAL_HYMNS) {
        renderCarousel();
    } else {
        updateCarouselActive();
    }
    window.scrollTo({ top: 0 });

    try {
        const hymn = await fetchJSON(`/api/hymns/${chapter}`);

        const newImg = new Image();
        newImg.className = 'hymn-sheet-img';
        newImg.alt = `찬송가 ${chapter}장 악보`;

        newImg.onload = () => {
            if (currentChapter === chapter) {
                hymnDetailContent.innerHTML = '';
                hymnDetailContent.appendChild(newImg);
            }
        };
        newImg.onerror = () => {
            if (currentChapter === chapter) {
                if (!newImg.src.includes('?retry=')) {
                    newImg.src = `${hymn.downloadUrl}?retry=${Date.now()}`;
                } else {
                    hymnDetailContent.innerHTML = '<div class="loader" style="color:red;">이미지를 불러오지 못했습니다.</div>';
                }
            }
        };
        newImg.src = hymn.downloadUrl;

    } catch (err) {
        if (currentChapter === chapter) {
            hymnDetailContent.innerHTML = `<div class="loader">오류: ${err.message}</div>`;
        }
    }
}

// ===== 캐러셀 =====
function renderCarousel() {
    hymnCarousel.innerHTML = '';
    for (let i = 1; i <= TOTAL_HYMNS; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-carousel-btn' + (i === currentChapter ? ' active' : '');
        btn.textContent = i;
        btn.dataset.chapter = i;
        btn.addEventListener('click', () => {
            if (i === currentChapter) return;
            loadHymn(i);
        });
        hymnCarousel.appendChild(btn);
    }
    requestAnimationFrame(() => {
        const activeBtn = hymnCarousel.querySelector('.chapter-carousel-btn.active');
        if (!activeBtn) return;
        hymnCarousel.scrollTo({
            left: activeBtn.offsetLeft - hymnCarousel.offsetWidth / 2 + activeBtn.offsetWidth / 2,
            behavior: 'smooth',
        });
    });
}

function updateCarouselActive() {
    hymnCarousel.querySelectorAll('.chapter-carousel-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.chapter) === currentChapter);
    });
    requestAnimationFrame(() => {
        const activeBtn = hymnCarousel.querySelector('.chapter-carousel-btn.active');
        if (!activeBtn) return;
        hymnCarousel.scrollTo({
            left: activeBtn.offsetLeft - hymnCarousel.offsetWidth / 2 + activeBtn.offsetWidth / 2,
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
        hymnCarouselWrap.classList.add('carousel-hidden');
        carouselHidden = true;
    } else if (delta < -5 && carouselHidden) {
        hymnCarouselWrap.classList.remove('carousel-hidden');
        carouselHidden = false;
    }
    lastScrollY = window.scrollY;
}, { passive: true });

// ===== 스와이프 제스처 =====
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;

document.getElementById('main').addEventListener('touchstart', (e) => {
    if (e.target.closest('.chapter-carousel-wrap')) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = true;
    hymnDetailContent.style.transition = 'none';
}, { passive: true });

document.getElementById('main').addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
        if ((currentChapter === 1 && dx > 0) || (currentChapter === TOTAL_HYMNS && dx < 0)) {
            hymnDetailContent.style.transform = `translateX(${dx * 0.3}px)`;
        } else {
            hymnDetailContent.style.transform = `translateX(${dx}px)`;
            hymnDetailContent.style.opacity = `${1 - Math.abs(dx) / (window.innerWidth * 1.5)}`;
        }
    }
}, { passive: true });

document.getElementById('main').addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    hymnDetailContent.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        if (dx < 0 && currentChapter < TOTAL_HYMNS) {
            hymnDetailContent.style.transform = `translateX(${-window.innerWidth}px)`;
            hymnDetailContent.style.opacity = '0';
            setTimeout(() => loadHymn(currentChapter + 1), 250);
            return;
        } else if (dx > 0 && currentChapter > 1) {
            hymnDetailContent.style.transform = `translateX(${window.innerWidth}px)`;
            hymnDetailContent.style.opacity = '0';
            setTimeout(() => loadHymn(currentChapter - 1), 250);
            return;
        }
    }

    hymnDetailContent.style.transform = 'translateX(0)';
    hymnDetailContent.style.opacity = '1';
}, { passive: true });

// ===== 실행 =====
init();
