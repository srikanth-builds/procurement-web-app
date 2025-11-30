import { Injectable, signal, effect } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private readonly THEME_KEY = 'theme-preference';

    // Initialize with saved theme or system preference
    darkMode = signal<boolean>(this.getInitialTheme());

    constructor() {
        // Effect to apply theme class to document body whenever signal changes
        effect(() => {
            const isDark = this.darkMode();
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
        });
    }

    toggleTheme() {
        this.darkMode.update(dark => !dark);
    }

    private getInitialTheme(): boolean {
        const savedTheme = localStorage.getItem(this.THEME_KEY);
        if (savedTheme) {
            return savedTheme === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
}
