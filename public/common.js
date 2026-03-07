// ===== Service Worker 등록 =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('SW 등록 성공:', reg.scope))
            .catch(err => console.log('SW 등록 실패:', err));
    });
}

// ===== API =====
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ===== Toast =====
let _toastTimer;
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(_toastTimer);
    toast.textContent = message;
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    _toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
}

// ===== Settings =====
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
    wakeLock: localStorage.getItem('bible-wakeLock') === 'true',                      // [PWA] 화면 꺼짐 방지
    contentWidth: parseInt(localStorage.getItem('bible-contentWidth')) || 95,         // [UI/UX] 본문 폭 (80~100)
};

// textEl: 글자 크기/굵기/폰트를 적용할 DOM 요소 (verses-content 등). null이면 생략.
function applySettings(textEl) {
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.setAttribute('data-bottom-align', settings.bottomAlign);

    const themeToggle = document.getElementById('theme-toggle');
    const boldToggle = document.getElementById('bold-toggle');
    const bottomAlignToggle = document.getElementById('bottom-align-toggle');
    const fontSizeValue = document.getElementById('font-size-value');
    const fontFamilyOptions = document.getElementById('font-family-options');
    const wakeLockToggle = document.getElementById('wake-lock-toggle');
    const contentWidthSlider = document.getElementById('content-width-slider');
    const contentWidthValue = document.getElementById('content-width-value');

    if (themeToggle) themeToggle.classList.toggle('active', settings.theme === 'dark');
    if (boldToggle) boldToggle.classList.toggle('active', settings.bold);
    if (bottomAlignToggle) bottomAlignToggle.classList.toggle('active', settings.bottomAlign);
    if (fontSizeValue) fontSizeValue.textContent = settings.fontSize;
    if (fontFamilyOptions) {
        fontFamilyOptions.querySelectorAll('.font-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.font === settings.fontFamily);
        });
    }
    // [PWA] Wake Lock 토글 상태 반영
    if (wakeLockToggle) wakeLockToggle.classList.toggle('active', settings.wakeLock);
    // [UI/UX] 본문 폭 슬라이더 값·레이블·CSS 변수 실시간 반영
    if (contentWidthSlider) contentWidthSlider.value = settings.contentWidth;
    if (contentWidthValue) contentWidthValue.textContent = settings.contentWidth + '%';
    document.documentElement.style.setProperty('--verse-padding', ((100 - settings.contentWidth) / 2) + '%');

    if (textEl) {
        textEl.style.fontSize = settings.fontSize + 'px';
        textEl.style.fontWeight = settings.bold ? '700' : '400';
        textEl.style.fontFamily = FONT_MAP[settings.fontFamily];
    }
}

function saveSettings() {
    localStorage.setItem('bible-theme', settings.theme);
    localStorage.setItem('bible-fontSize', settings.fontSize);
    localStorage.setItem('bible-bold', settings.bold);
    localStorage.setItem('bible-fontFamily', settings.fontFamily);
    localStorage.setItem('bible-bottomAlign', settings.bottomAlign);
    localStorage.setItem('bible-wakeLock', settings.wakeLock);       // [PWA]
    localStorage.setItem('bible-contentWidth', settings.contentWidth); // [UI/UX]
}

// 설정 패널 HTML을 #app에 삽입하고 이벤트 바인딩
// textEl: 글자 스타일을 실시간 반영할 DOM 요소 (없으면 null)
function initSettingsPanel(textEl) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
        <div id="settings-overlay" class="settings-overlay hidden"></div>
        <div id="settings-panel" class="settings-panel hidden">
          <div class="settings-header">
            <span class="settings-title">설정</span>
            <button id="settings-close" class="settings-close-btn" aria-label="닫기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="settings-item">
            <span class="settings-label">다크 모드</span>
            <button id="theme-toggle" class="toggle-switch" aria-label="다크모드 토글">
              <span class="toggle-knob"></span>
            </button>
          </div>
          <div class="settings-item">
            <span class="settings-label">글자 크기</span>
            <div class="font-size-control">
              <button id="font-size-down" class="size-btn" aria-label="글자 작게">−</button>
              <span id="font-size-value" class="size-value">16</span>
              <button id="font-size-up" class="size-btn" aria-label="글자 크게">+</button>
            </div>
          </div>
          <div class="settings-item">
            <span class="settings-label">굵은 글씨</span>
            <button id="bold-toggle" class="toggle-switch" aria-label="볼드 토글">
              <span class="toggle-knob"></span>
            </button>
          </div>
          <div class="settings-item settings-item-col">
            <span class="settings-label">글씨체</span>
            <div class="font-family-options" id="font-family-options">
              <button class="font-option" data-font="serif">명조체</button>
              <button class="font-option" data-font="sans">고딕체</button>
              <button class="font-option" data-font="pretendard">프리텐다드</button>
            </div>
          </div>
          <div class="settings-item">
            <span class="settings-label">하단 정렬</span>
            <button id="bottom-align-toggle" class="toggle-switch" aria-label="하단 정렬 토글">
              <span class="toggle-knob"></span>
            </button>
          </div>
          <div class="settings-item">
            <span class="settings-label">화면 꺼짐 방지</span>
            <button id="wake-lock-toggle" class="toggle-switch" aria-label="화면 꺼짐 방지 토글">
              <span class="toggle-knob"></span>
            </button>
          </div>
          <div class="settings-item settings-item-col">
            <div class="settings-row-between">
              <span class="settings-label">본문 폭</span>
              <span id="content-width-value" class="size-value">95%</span>
            </div>
            <input type="range" id="content-width-slider" class="width-slider"
              min="80" max="100" step="1" value="95" aria-label="본문 폭 조절">
          </div>
        </div>
    `;
    document.getElementById('app').appendChild(wrap);

    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsClose = document.getElementById('settings-close');
    const themeToggle = document.getElementById('theme-toggle');
    const boldToggle = document.getElementById('bold-toggle');
    const bottomAlignToggle = document.getElementById('bottom-align-toggle');
    const fontSizeUp = document.getElementById('font-size-up');
    const fontSizeDown = document.getElementById('font-size-down');
    const fontFamilyOptions = document.getElementById('font-family-options');

    function openPanel() {
        settingsPanel.classList.remove('hidden');
        settingsOverlay.classList.remove('hidden');
    }
    function closePanel() {
        settingsPanel.classList.add('hidden');
        settingsOverlay.classList.add('hidden');
    }

    settingsBtn.addEventListener('click', e => {
        e.stopPropagation();
        settingsPanel.classList.contains('hidden') ? openPanel() : closePanel();
    });
    settingsClose.addEventListener('click', closePanel);
    settingsOverlay.addEventListener('click', closePanel);

    themeToggle.addEventListener('click', () => {
        settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
        applySettings(textEl);
        saveSettings();
    });
    fontSizeUp.addEventListener('click', () => {
        if (settings.fontSize < 24) { settings.fontSize++; applySettings(textEl); saveSettings(); }
    });
    fontSizeDown.addEventListener('click', () => {
        if (settings.fontSize > 12) { settings.fontSize--; applySettings(textEl); saveSettings(); }
    });
    boldToggle.addEventListener('click', () => {
        settings.bold = !settings.bold;
        applySettings(textEl);
        saveSettings();
    });
    fontFamilyOptions.querySelectorAll('.font-option').forEach(btn => {
        btn.addEventListener('click', () => {
            settings.fontFamily = btn.dataset.font;
            applySettings(textEl);
            saveSettings();
        });
    });
    bottomAlignToggle.addEventListener('click', () => {
        settings.bottomAlign = !settings.bottomAlign;
        applySettings(textEl);
        saveSettings();
    });

    // [PWA] 화면 꺼짐 방지 토글 — 변경 시 verses.js로 CustomEvent 전달
    const wakeLockToggle = document.getElementById('wake-lock-toggle');
    const contentWidthSlider = document.getElementById('content-width-slider');
    wakeLockToggle.addEventListener('click', () => {
        settings.wakeLock = !settings.wakeLock;
        applySettings(textEl);
        saveSettings();
        window.dispatchEvent(new CustomEvent('settingsWakeLockChange', { detail: settings.wakeLock }));
    });

    // [UI/UX] 본문 폭 슬라이더 — input 이벤트로 실시간 반영
    contentWidthSlider.addEventListener('input', () => {
        settings.contentWidth = parseInt(contentWidthSlider.value);
        applySettings(textEl);
        saveSettings();
    });

    applySettings(textEl);
}
