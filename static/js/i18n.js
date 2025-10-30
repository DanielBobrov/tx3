// Система локализации для JavaScript
class I18n {
    constructor(locale = 'ru') {
        this.locale = locale;
        this.translations = {
            ru: {
                // Игровые сообщения
                'game.already_finished': 'Игра уже завершена!',
                'game.won': 'Победил',
                'game.move': 'Ход:',
                
                // Ошибки PGN
                'pgn.invalid_format': 'Неверный формат PGN. Должна быть строка из цифр 0-8.',
                'pgn.error_at_move': 'Ошибка на ходе',
                'pgn.could_not_apply': 'Не удалось применить ход',
                
                // Буфер обмена
                'clipboard.empty': 'Буфер обмена пуст',
                'clipboard.access_denied': 'Не удалось прочитать буфер обмена. Убедитесь что разрешили доступ.',
                
                // Уведомления
                'notification.made_move': 'сделал ход',
                'notification.title': 'Кресты-обручи',
                
                // Навигация
                'nav.first': 'В начало',
                'nav.previous': 'Предыдущий ход',
                'nav.next': 'Следующий ход',
                'nav.last': 'В конец',
            },
            en: {
                // Game messages
                'game.already_finished': 'Game already finished!',
                'game.won': 'Won',
                'game.move': 'Move:',
                
                // PGN errors
                'pgn.invalid_format': 'Invalid PGN format. Should be a string of digits 0-8.',
                'pgn.error_at_move': 'Error at move',
                'pgn.could_not_apply': 'Could not apply move',
                
                // Clipboard
                'clipboard.empty': 'Clipboard is empty',
                'clipboard.access_denied': 'Could not read clipboard. Make sure you allowed access.',
                
                // Notifications
                'notification.made_move': 'made a move',
                'notification.title': 'Tic-Tac-Toe',
                
                // Navigation
                'nav.first': 'First',
                'nav.previous': 'Previous move',
                'nav.next': 'Next move',
                'nav.last': 'Last',
            }
        };
    }

    t(key, params = {}) {
        let translation = this.translations[this.locale]?.[key] || key;
        
        // Подстановка параметров
        Object.keys(params).forEach(param => {
            translation = translation.replace(`{${param}}`, params[param]);
        });
        
        return translation;
    }

    setLocale(locale) {
        if (this.translations[locale]) {
            this.locale = locale;
        }
    }
}

// Глобальная инстанция
window.i18n = new I18n(window.LOCALE || 'ru');
