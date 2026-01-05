export class ThemeManager {
    constructor() {
        this.theme = 'dark'; // default
        this.init();
    }

    init() {
        // Check local storage or system preference
        const savedTheme = localStorage.getItem('app-theme');
        if (savedTheme) {
            this.theme = savedTheme;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            this.theme = 'light';
        }

        this.applyTheme(this.theme);
        this.updateToggleButton();
    }

    toggle() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.theme);
        localStorage.setItem('app-theme', this.theme);
        this.updateToggleButton();
    }

    applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    updateToggleButton() {
        const btn = document.getElementById('theme-toggle-btn');
        if (!btn) return;

        // Update icon based on NEW theme (to show what it IS or what it WILL BE? Usually "Switch to X")
        // But icon usually represents current state. Sun for Light, Moon for Dark.
        // Let's toggle the SVG content.

        if (this.theme === 'dark') {
            // Show Moon (indicating night/dark mode is active) or Sun (click to go light)?
            // Standard: Show the icon of the MODE you are IN, or the mode you switch TO.
            // Let's show the icon of the mode we are currently IN. 
            // Dark Mode -> Show Moon. 
            // Wait, usually it's "Click Sun to go Light". 
            // Let's do: Icon shows Current State.

            // Moon Icon
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            `;
            btn.title = "Switch to Light Mode";
        } else {
            // Sun Icon
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
            `;
            btn.title = "Switch to Dark Mode";
        }
    }
}
