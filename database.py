import pickle
import sqlite3
from dataclasses import fields, asdict
from typing import Type, Generic, TypeVar, Union, Iterator, Any

from utils import *

T = TypeVar('T')


class Database(Generic[T]):
    """
    Класс для работы с SQLite базой данных с интерфейсом как у list.
    Хранит данные любого типа, сериализуя их в JSON или pickle.
    """

    def __init__(self, item_type: Type[T], db_path: str = ":memory:", table_name: str = "data"):
        """
        Инициализация базы данных.

        Args:
            db_path: Путь к файлу БД или ':memory:' для БД в памяти
            table_name: Имя таблицы для хранения данных
        """
        self.item_type = item_type
        self.db_path = db_path
        self.table_name = table_name
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()
        self.dataclass_fields = [i for i in fields(self.item_type) if i.name != "id"]
        self._create_table()

    def _get_sql_type(self, py_type: Type) -> str:
        """Простое сопоставление типов Python с типами SQLite."""
        # Для простоты и гибкости:
        if py_type is int:
            return 'INTEGER'
        if py_type is float:
            return 'REAL'
        # Все остальное (str, list, dict, custom objects, Optional, Union) храним как TEXT
        return 'TEXT'

    def _create_table(self):
        """Динамическое создание таблицы на основе полей датакласса."""

        column_definitions = ["id INTEGER PRIMARY KEY AUTOINCREMENT"]

        for field in self.dataclass_fields:
            # Извлекаем базовый тип, игнорируя Optional, Union, и т.п. для простого маппинга
            py_type = field.type

            sql_type = self._get_sql_type(py_type)
            column_definitions.append(f"{field.name} {sql_type}")

        schema = ",\n".join(column_definitions)

        self.cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS {self.table_name} (
                {schema}
            )
        ''')
        self.conn.commit()

    def _serialize(self, item: T) -> tuple[list[str, Any], list[str]]:
        """
        Сериализация объекта для хранения в БД.

        Returns:
            columns, values
        """
        obj = asdict(item)
        obj = {i: obj[i] for i in obj.keys() if i != "id"}
        columns = obj.keys()
        values = []
        for i in list(obj.values()):
            values.append(pickle.dumps(i).hex())
        return columns, values

    def _deserialize(self, row) -> T:
        """Десериализация объекта из БД."""
        fields = [i.name for i in self.dataclass_fields]
        kwargs = {"id": row[0]}
        for field, val in zip(fields, row[1:]):
            kwargs[field] = pickle.loads(bytes.fromhex(val))
        return self.item_type(**kwargs)

    def _normalize_index(self, index: int) -> int:
        """Нормализация отрицательных индексов."""
        if index < 0:
            index = len(self) + index
        if index < 0 or index > len(self):
            raise IndexError("list index out of range")
        return index

    def append(self, item: T) -> int:
        """Добавление элемента в конец."""
        columns, values = self._serialize(item)
        self.cursor.execute(
            f"INSERT INTO {self.table_name} ({", ".join(columns)}) VALUES ({", ".join(["?"] * len(columns))})",
            values
        )
        item_id = self.cursor.lastrowid
        self.conn.commit()
        return item_id

    def extend(self, iterable) -> None:
        """Расширение списка элементами из итерируемого объекта."""
        for item in iterable:
            self.append(item)

    def insert(self, index: int, item: Game) -> None:
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
            columns, values = self._serialize(item)
            self.cursor.execute(
                f"INSERT INTO {self.table_name} ({", ".join(columns)}) VALUES ({", ".join(["?"] * len(columns))})",
                values
            )
            self.conn.commit()

    def remove(self, item: Game) -> None:
        """Удаление первого вхождения элемента."""
        for i, elem in enumerate(self):
            if elem == item:
                del self[i]
                return
        raise ValueError(f"{item!r} not in list")

    def pop(self, index: int = -1) -> Game:
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

    def index(self, item: Game, start: int = 0, stop: Optional[int] = None) -> int | None:
        """Поиск индекса первого вхождения элемента."""
        stop = stop if stop is not None else len(self)
        for i in range(start, stop):
            if i < len(self) and self[i] == item:
                return i
        return None

    def get_by(self, key, value) -> list[T]:
        """Получение элементов по ключу и значению."""
        # Получаем список столбцов из метаданных таблицы
        self.cursor.execute(f"PRAGMA table_info({self.table_name})")
        columns = [row[1] for row in self.cursor.fetchall()]

        if key not in columns:
            raise ValueError(f"Столбец '{key}' не существует в таблице {self.table_name}")

        result = []
        # self.conn.set_trace_callback(print)
        # print(pickle.dumps(value).hex())

        # Безопасно вставляем имя столбца после валидации
        self.cursor.execute(
            f"SELECT * FROM {self.table_name} WHERE {key} = ?",
            (pickle.dumps(value).hex(),)
        )
        rows = self.cursor.fetchall()
        if rows:
            result = [self._deserialize(row) for row in rows]
        return result

    def count(self, item: Game) -> int:
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

    def __getitem__(self, key: Union[int, slice]) -> T:
        """Получение элемента по индексу или срезу."""
        if isinstance(key, slice):
            # Обработка среза
            start, stop, step = key.indices(len(self))
            result = []
            for i in range(start, stop, step):
                self.cursor.execute(
                    f"SELECT * FROM {self.table_name} WHERE id = ?",
                    (i,)
                )
                row = self.cursor.fetchone()
                if row:
                    result.append(self._deserialize(row))
            return result
        elif isinstance(key, int):
            # Обработка индекса
            index = self._normalize_index(key)
            self.cursor.execute(
                f"SELECT * FROM {self.table_name} WHERE id = ?",
                (index,)
            )
            row = self.cursor.fetchone()
            if row:
                return self._deserialize(row)
            return None
        else:
            return None

    def __setitem__(self, key: Union[int, slice], value: T) -> None:
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
                columns, values = self._serialize(value)
                cmd = f"UPDATE {self.table_name} SET {", ".join([col + ' = ?' for col in columns])} WHERE id = ?"
                self.cursor.execute(cmd,
                                    values + [row[0]]
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

    def __contains__(self, item: Game) -> bool:
        """Проверка наличия элемента."""
        for elem in self:
            if elem == item:
                return True
        return False

    def __iter__(self) -> Iterator[Game]:
        """Итератор по элементам."""
        self.cursor.execute(f"SELECT * FROM {self.table_name} ORDER BY id")
        for row in self.cursor.fetchall():
            yield self._deserialize(row)

    def __reversed__(self) -> Iterator[Game]:
        """Обратный итератор."""
        self.cursor.execute(f"SELECT * FROM {self.table_name} ORDER BY id DESC")
        for row in self.cursor.fetchall():
            yield self._deserialize(row)

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


if __name__ == "__main__":
    db = Database(Game)
    id_ = db.append(
        Game(
            id=0,
            players=[None, None],
            use_time=False,
            left_time=[60, 60],
            time_addition=10,
            last_move_time=-1,
        )
    )
    obj = db[id_]
    print(obj)
    obj.players = [0, 0]
    db[id_] = obj
    print(db[id_])
