// Функция для форматирования времени с условным отображением
function formatTime(totalMilliseconds) {
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((totalMilliseconds % 1000) / 10);

    let result = '';

    // Добавляем дни, только если они больше 0
    if (days > 0) {
        result += `${days}д `;
    }

    // Добавляем часы, только если они больше 0 или есть дни
    if (hours > 0 || days > 0) {
        result += `${hours.toString().padStart(2, '0')}:`;
    }

    // Минуты и секунды показываем всегда
    result += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;

    return result;
}

function createTimer(totalSeconds, startTime, elem) {
    const totalMilliseconds = totalSeconds * 1000;
    // const startTime = Date.now();

    // Функция для обновления отображения
    function updateDisplay() {
        const elapsed = Date.now() - startTime;
        const timeLeft = Math.max(0, totalMilliseconds - elapsed);

        elem.textContent = formatTime(timeLeft);

        if (timeLeft === 0) {
            console.log(`startTime: ${startTime}\tnow: ${Date.now()}`)
            clearInterval(interval);
            console.log('Время вышло!');
        }
    }

    // Показываем начальное время
    updateDisplay();

    // Запускаем интервал с частотой 10мс для отображения сотых
    var interval = setInterval(updateDisplay, 10);

    // Возвращаем функцию для остановки таймера
    return () => clearInterval(interval);
}