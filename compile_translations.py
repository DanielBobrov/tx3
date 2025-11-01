#!/usr/bin/env python3
"""
Скрипт для компиляции переводов Flask-Babel
"""
import subprocess
import sys
import os

def run_command(cmd, description):
    """Выполняет команду и выводит результат"""
    print(f"\n{'='*60}")
    print(f"{description}")
    print(f"{'='*60}")
    print(f"Команда: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.stdout:
        print(result.stdout)
    
    if result.returncode != 0:
        print(f"❌ Ошибка: {result.stderr}", file=sys.stderr)
        return False
    else:
        print(f"✅ Успешно!")
    
    return True

def main():
    """Главная функция"""
    # Проверяем, что мы в правильной директории
    if not os.path.exists('babel.cfg'):
        print("❌ Ошибка: файл babel.cfg не найден!")
        print("Пожалуйста, запустите скрипт из корневой директории проекта")
        sys.exit(1)
    
    print("🌐 Компиляция переводов Flask-Babel")
    
    # Компилируем переводы
    if not run_command(
        ['pybabel', 'compile', '-d', 'translations'],
        "Компиляция .po файлов в .mo"
    ):
        sys.exit(1)
    
    print("\n" + "="*60)
    print("✅ Все переводы успешно скомпилированы!")
    print("="*60)
    print("\nТеперь можно запустить приложение и переключать язык.")

if __name__ == '__main__':
    main()
