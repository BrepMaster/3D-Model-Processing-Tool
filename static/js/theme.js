function applyTheme(themeName) {
    const body = document.body;
    
    body.style.transition = 'background-color 0.4s ease, color 0.3s ease';
    
    body.classList.remove('light-theme', 'dark-theme', 'ocean-theme', 'sunset-theme', 'forest-theme', 'violet-theme', 'cyber-theme', 'retro-theme', 'minimal-theme', 'simple-white-theme', 'simple-gray-theme', 'simple-blue-theme', 'simple-mint-theme', 'simple-coral-theme', 'default-theme', 'modern-theme', 'glass-theme', 'apple-theme', 'bento-theme');
    
    if (themeName !== 'default') {
        body.classList.add(themeName + '-theme');
    } else {
        body.classList.add('default-theme');
    }
    
    localStorage.setItem('theme', themeName);
    
    const event = new CustomEvent('themeChanged', { detail: { theme: themeName } });
    document.dispatchEvent(event);
}

function loadAndApplyTheme() {
    const savedTheme = localStorage.getItem('theme') || 'default';
    applyTheme(savedTheme);
    return savedTheme;
}

function initThemeButtons(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.addEventListener('click', function(e) {
        if (e.target.classList.contains('theme-btn')) {
            const themeName = e.target.id.replace('theme-', '');
            applyTheme(themeName);
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadAndApplyTheme();
});

function getSceneBackgroundColor(themeName) {
    switch (themeName) {
        case 'light':
            return 0xf8fafc;
        case 'dark':
            return 0x0f172a;
        case 'ocean':
            return 0x0c1524;
        case 'sunset':
            return 0x1e1b18;
        case 'forest':
            return 0x0d1b12;
        case 'violet':
            return 0x1a122e;
        case 'cyber':
            return 0x0a0a0f;
        case 'retro':
            return 0x2d1b0e;
        case 'minimal':
            return 0x374151;
        case 'simple-white':
            return 0xffffff;
        case 'simple-gray':
            return 0x4b5563;
        case 'simple-blue':
            return 0x1e3a5f;
        case 'simple-mint':
            return 0x0f3433;
        case 'simple-coral':
            return 0x4a1f1f;
        case 'modern':
            return 0xf8fafc;
        case 'glass':
            return 0x0a0a1a;
        case 'apple':
            return 0xf5f5f7;
        case 'bento':
            return 0x0c0c0e;
        default:
            return 0x1e293b;
    }
}