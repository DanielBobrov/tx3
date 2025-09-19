import json
import pickle
import sqlite3
from typing import Any, Iterator, Optional, Union


class Database:
    """
    Класс для работы с SQLite базой данных с интерфейсом как у list.
    Хранит данные любого типа, сериализуя их в JSON или pickle.
    """

    def __init__(self, db_path: str = ":memory:", table_name: str = "data"):
        """
        Инициализация базы данных.

        Args:
            db_path: Путь к файлу БД или ':memory:' для БД в памяти
            table_name: Имя таблицы для хранения данных
        """
        self.db_path = db_path
        self.table_name = table_name
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()
        self._create_table()

    def _create_table(self):
        """Создание таблицы если она не существует."""
        self.cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS {self.table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL,
                type TEXT NOT NULL
            )
        ''')
        self.conn.commit()

    def _serialize(self, item: Any) -> tuple[str, str]:
        """
        Сериализация объекта для хранения в БД.

        Returns:
            Кортеж (сериализованные данные, тип сериализации)
        """
        try:
            # Пробуем JSON для простых типов
            return json.dumps(item), 'json'
        except (TypeError, ValueError):
            # Используем pickle для сложных объектов
            return pickle.dumps(item).hex(), 'pickle'

    def _deserialize(self, data: str, data_type: str) -> Any:
        """Десериализация объекта из БД."""
        if data_type == 'json':
            return json.loads(data)
        else:  # pickle
            return pickle.loads(bytes.fromhex(data))

    def _normalize_index(self, index: int) -> int:
        """Нормализация отрицательных индексов."""
        if index < 0:
            index = len(self) + index
        if index < 0 or index > len(self):
            raise IndexError("list index out of range")
        return index

    def append(self, item: Any) -> int:
        """Добавление элемента в конец."""
        data, data_type = self._serialize(item)
        self.cursor.execute(
            f"INSERT INTO {self.table_name} (data, type) VALUES (?, ?)",
            (data, data_type)
        )
        item_id = self.cursor.lastrowid
        self.conn.commit()

        return item_id

    def extend(self, iterable) -> None:
        """Расширение списка элементами из итерируемого объекта."""
        for item in iterable:
            self.append(item)

    def insert(self, index: int, item: Any) -> None:
        """Вставка элемента по индексу."""
        length = len(self)

        # Обработка граничных случаев как в list
        if index < 0:
            index = max(0, length + index)
        else:
            index = min(index, length)

        # Если вставляем в конец
        if index >= length:
            self.append(item)
            return

        # Получаем id элемента на позиции index
        self.cursor.execute(
            f"SELECT id FROM {self.table_name} ORDER BY id LIMIT 1 OFFSET ?",
            (index,)
        )
        row = self.cursor.fetchone()

        if row:
            target_id = row[0]
            # Сдвигаем id всех элементов начиная с target_id
            self.cursor.execute(
                f"UPDATE {self.table_name} SET id = -id WHERE id >= ?",
                (target_id,)
            )
            self.cursor.execute(
                f"UPDATE {self.table_name} SET id = -id - 1 WHERE id < 0"
            )
            self.cursor.execute(
                f"UPDATE {self.table_name} SET id = -id WHERE id < 0"
            )

            # Вставляем новый элемент
            data, data_type = self._serialize(item)
            self.cursor.execute(
                f"INSERT INTO {self.table_name} (id, data, type) VALUES (?, ?, ?)",
                (target_id, data, data_type)
            )
            self.conn.commit()

    def remove(self, item: Any) -> None:
        """Удаление первого вхождения элемента."""
        for i, elem in enumerate(self):
            if elem == item:
                del self[i]
                return
        raise ValueError(f"{item!r} not in list")

    def pop(self, index: int = -1) -> Any:
        """Удаление и возврат элемента по индексу."""
        if len(self) == 0:
            raise IndexError("pop from empty list")

        index = self._normalize_index(index)
        item = self[index]
        del self[index]
        return item

    def clear(self) -> None:
        """Очистка всех элементов."""
        self.cursor.execute(f"DELETE FROM {self.table_name}")
        self.conn.commit()

    def index(self, item: Any, start: int = 0, stop: Optional[int] = None) -> int:
        """Поиск индекса первого вхождения элемента."""
        stop = stop if stop is not None else len(self)
        for i in range(start, stop):
            if i < len(self) and self[i] == item:
                return i
        return None

    def count(self, item: Any) -> int:
        """Подсчет количества вхождений элемента."""
        return sum(1 for elem in self if elem == item)

    def reverse(self) -> None:
        """Разворот списка на месте."""
        items = list(self)
        self.clear()
        for item in reversed(items):
            self.append(item)

    def sort(self, *, key=None, reverse: bool = False) -> None:
        """Сортировка списка на месте."""
        items = list(self)
        items.sort(key=key, reverse=reverse)
        self.clear()
        for item in items:
            self.append(item)

    def copy(self) -> list:
        """Создание поверхностной копии в виде обычного списка."""
        return list(self)

    def __len__(self) -> int:
        """Получение длины."""
        self.cursor.execute(f"SELECT COUNT(*) FROM {self.table_name}")
        return self.cursor.fetchone()[0]

    def __getitem__(self, key: Union[int, slice]) -> Any:
        """Получение элемента по индексу или срезу."""
        if isinstance(key, slice):
            # Обработка среза
            start, stop, step = key.indices(len(self))
            result = []
            for i in range(start, stop, step):
                self.cursor.execute(
                    f"SELECT data, type FROM {self.table_name} WHERE id = ?",
                    (i,)
                )
                row = self.cursor.fetchone()
                if row:
                    result.append(self._deserialize(row[0], row[1]))
            return result
        elif isinstance(key, int):
            # Обработка индекса
            index = self._normalize_index(key)
            self.cursor.execute(
                f"SELECT data, type FROM {self.table_name} WHERE id = ?",
                (index,)
            )
            row = self.cursor.fetchone()
            if row:
                return self._deserialize(row[0], row[1])
            return None
        else:
            return None

    def __setitem__(self, key: Union[int, slice], value: Any) -> None:
        """Установка элемента по индексу или срезу."""
        if isinstance(key, slice):
            # Обработка среза
            start, stop, step = key.indices(len(self))

            if step != 1:
                # Для шага != 1 требуется точное соответствие длин
                indices = list(range(start, stop, step))
                values = list(value)
                if len(indices) != len(values):
                    raise ValueError("attempt to assign sequence of size {} to extended slice of size {}".format(
                        len(values), len(indices)))

                for i, val in zip(indices, values):
                    self[i] = val
            else:
                # Удаляем старые элементы
                for _ in range(stop - start):
                    if start < len(self):
                        del self[start]

                # Вставляем новые
                for i, item in enumerate(value):
                    self.insert(start + i, item)
        else:
            # Обработка индекса
            index = self._normalize_index(key)

            # Получаем id элемента
            self.cursor.execute(
                f"SELECT id FROM {self.table_name} WHERE id = ?",
                (index,)
            )
            row = self.cursor.fetchone()

            if row:
                data, data_type = self._serialize(value)
                self.cursor.execute(
                    f"UPDATE {self.table_name} SET data = ?, type = ? WHERE id = ?",
                    (data, data_type, row[0])
                )
                self.conn.commit()

    def __delitem__(self, key: Union[int, slice]) -> None:
        """Удаление элемента по индексу или срезу."""
        if isinstance(key, slice):
            # Обработка среза
            start, stop, step = key.indices(len(self))
            indices = list(range(start, stop, step))

            # Удаляем в обратном порядке чтобы индексы не сбивались
            for index in sorted(indices, reverse=True):
                del self[index]
        else:
            # Обработка индекса
            index = self._normalize_index(key)

            # Получаем id элемента
            self.cursor.execute(
                f"SELECT id FROM {self.table_name} WHERE id = ?",
                (index,)
            )
            row = self.cursor.fetchone()

            if row:
                self.cursor.execute(
                    f"DELETE FROM {self.table_name} WHERE id = ?",
                    (row[0],)
                )
                self.conn.commit()

    def __contains__(self, item: Any) -> bool:
        """Проверка наличия элемента."""
        for elem in self:
            if elem == item:
                return True
        return False

    def __iter__(self) -> Iterator[Any]:
        """Итератор по элементам."""
        self.cursor.execute(f"SELECT data, type FROM {self.table_name} ORDER BY id")
        for row in self.cursor.fetchall():
            yield self._deserialize(row[0], row[1])

    def __reversed__(self) -> Iterator[Any]:
        """Обратный итератор."""
        self.cursor.execute(f"SELECT data, type FROM {self.table_name} ORDER BY id DESC")
        for row in self.cursor.fetchall():
            yield self._deserialize(row[0], row[1])

    def __add__(self, other) -> list:
        """Конкатенация с другим итерируемым объектом."""
        result = list(self)
        result.extend(other)
        return result

    def __mul__(self, n: int) -> list:
        """Умножение списка."""
        result = []
        for _ in range(n):
            result.extend(self)
        return result

    def __rmul__(self, n: int) -> list:
        """Правое умножение."""
        return self * n

    def __eq__(self, other) -> bool:
        """Сравнение на равенство."""
        if not hasattr(other, '__len__') or not hasattr(other, '__getitem__'):
            return False
        if len(self) != len(other):
            return False
        for a, b in zip(self, other):
            if a != b:
                return False
        return True

    def __repr__(self) -> str:
        """Строковое представление."""
        return f"Database({list(self)!r})"

    def __str__(self) -> str:
        """Строковое представление."""
        return str(list(self))

    def close(self) -> None:
        """Закрытие соединения с БД."""
        self.conn.close()

    def __enter__(self):
        """Вход в контекстный менеджер."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Выход из контекстного менеджера."""
        self.close()


# Примеры использования
if __name__ == "__main__":
    # Создание БД в памяти
    db = Database()

    # Добавление элементов
    db.append(1)
    db.append("hello")
    db.append([1, 2, 3])
    db.append({"key": "value"})
    print(f"После append: {db}")

    # Индексация
    print(f"db[0] = {db[0]}")
    print(f"db[-1] = {db[-1]}")

    # Срезы
    print(f"db[1:3] = {db[1:3]}")

    # Изменение элемента
    db[1] = "world"
    print(f"После db[1] = 'world': {db}")

    # Вставка
    db.insert(1, "inserted")
    print(f"После insert(1, 'inserted'): {db}")

    # Удаление
    db.remove("inserted")
    print(f"После remove('inserted'): {db}")

    # Pop
    last = db.pop()
    print(f"После pop(): {db}, удален: {last}")

    # Проверка наличия
    print(f"1 in db: {1 in db}")

    # Итерация
    print("Итерация:")
    for item in db:
        print(f"  {item}")

    # Работа с файловой БД
    with Database("test.db") as file_db:
        file_db.extend([1, 2, 3, 4, 5])
        file_db.reverse()
        print(f"Файловая БД после reverse: {file_db}")
