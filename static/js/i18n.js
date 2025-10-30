// Система локализации для JavaScript
class I18n {
    constructor(locale = 'ru') {
        this.locale = locale;
        this.translations = {};
        this.loaded = false;
        this.loadPromise = null;
    }

    // Загрузка переводов из JSON
    async loadTranslations(locale) {
        if (this.translations[locale]) {
            return; // Уже загружено
        }

        try {
            const response = await fetch(`/static/locales/${locale}.json`);
            if (!response.ok) {
                console.error(`Failed to load translations for locale: ${locale}`);
                return;
            }
            const data = await response.json();
            this.translations[locale] = this.flattenObject(data);
        } catch (error) {
            console.error(`Error loading translations for ${locale}:`, error);
        }
    }

    // Преобразование вложенного объекта в плоский с точечной нотацией
    // {"game": {"won": "Победил"}} -> {"game.won": "Победил"}
    flattenObject(obj, prefix = '') {
        const result = {};
        for (const key in obj) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                Object.assign(result, this.flattenObject(obj[key], newKey));
            } else {
                result[newKey] = obj[key];
            }
        }
        return result;
    }

    // Инициализация - загрузка переводов для текущего языка
    async init() {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = this.loadTranslations(this.locale).then(() => {
            this.loaded = true;
        });

        return this.loadPromise;
    }

    // Получение перевода с подстановкой параметров
    t(key, params = {}) {
        if (!this.loaded) {
            console.warn('Translations not loaded yet. Call i18n.init() first.');
            return key;
        }

        let translation = this.translations[this.locale]?.[key] || key;
        
        // Подстановка параметров {name} -> значение
        Object.keys(params).forEach(param => {
            translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
        });
        
        return translation;
    }

    // Смена языка с загрузкой переводов
    async setLocale(locale) {
        this.locale = locale;
        await this.loadTranslations(locale);
        this.loaded = true;
    }
}

// Глобальная инстанция
window.i18n = new I18n(window.LOCALE || 'ru');

// Автоматическая инициализация при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.i18n.init();
    });
} else {
    window.i18n.init();
}
