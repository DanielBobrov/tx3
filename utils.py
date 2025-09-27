import dataclasses
import json
import pickle
import sqlite3
import threading
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Iterator, Optional, Union, List

WAITING, ACTIVE, ENDED = "waiting", "active", "ended"


@dataclass
class Game:
    id: int
    players: List[int]
    pgn: str = ""
    step: int = 0
    status: str = WAITING  # Предполагаю, что WAITING определена где-то в коде
    left_time: Optional[List[float]] = None
    time_addition: int = 0
    use_time: bool = False
    last_move_time: Optional[int] = None
    winner: Optional[str] = None
    fen: str = "0"*81

    def add_step(self, step):
        self.pgn += str(step)
        self.step = (self.step + 1) % 2

    def __get_grid(self):
        grid = [[None for __ in range(9)] for _ in range(9)]
        for i in range(9):
            for j in range(9):
                mark = self.fen[i * 9 + j]
                grid[i][j] = None if mark == "0" else "X" if mark == "1" else "O"
        return grid

    def __set_grid(self, grid):
        fen = ""
        for i in range(9):
            for j in range(9):
                fen += "0" if grid[i][j] is None else "1" if grid[i][j] == "X" else "2"
        self.fen = fen

    grid = property(__get_grid, __set_grid)

    @property
    def active_mini(self):
        if not self.pgn:
            return 4
        step = int(self.pgn[-1])
        return step

    def get_state_for_client(self):
        """Возвращает словарь с состоянием игры для отправки клиенту."""
        return {
            "grid": self.grid,
            "status": self.status,
            "pgn": self.pgn,
            "step": self.step,
            "players": self.players,
            "winner": self.winner,
            "left_time": [round(i, 2) for i in self.left_time],
            "last_move_time": self.last_move_time.timestamp() if self.last_move_time != -1 else None,
            "active_mini": self.active_mini
        }


@dataclasses.dataclass
class Player:
    username: str
    password: str
    id: int = None
    games: list[int] = dataclasses.field(default_factory=list)


class PlayersDatabase:
    """
    Класс для работы с SQLite базой данных с интерфейсом как у list.
    Хранит данные любого типа, сериализуя их в JSON или pickle.
    """

    def __init__(self, db_path: str = ":memory:", table_name: str = "players"):
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
                username TEXT,
                data TEXT,
                type TEXT
            )
        ''')
        self.conn.commit()

    def _serialize(self, item: Player) -> tuple[str, str]:
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
            raise IndexError(f"list index out of range, {index=}, {len(self)=}")
        return index

    def append(self, item: Player) -> int:
        """Добавление элемента в конец."""
        data_dict = asdict(item)
        # Убираем id из словаря, если он есть, чтобы база сама его назначила
        data_dict.pop('id', None)
        data_dict.pop('player_id', None)

        columns = ', '.join(data_dict.keys())
        placeholders = ', '.join(['?' for _ in data_dict])
        values = tuple(data_dict.values())

        self.cursor.execute(
            f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})",
            values
        )
        player_id = self.cursor.lastrowid
        self.conn.commit()

        item.id = player_id
        self[player_id] = item
        return player_id

    def extend(self, iterable) -> None:
        """Расширение списка элементами из итерируемого объекта."""
        for item in iterable:
            self.append(item)

    def insert(self, index: int, item: Player) -> None:
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
            data_dict = asdict(item)
            data_dict['id'] = target_id
            columns = ', '.join(data_dict.keys())
            placeholders = ', '.join(['?' for _ in data_dict])
            values = tuple(data_dict.values())
            self.cursor.execute(
                f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})",
                values
            )
            self.conn.commit()

    def remove(self, item: Player) -> None:
        """Удаление первого вхождения элемента."""
        for i, elem in enumerate(self):
            if elem == item:
                del self[i]
                return
        raise ValueError(f"{item!r} not in Database")

    def pop(self, index: int = -1) -> Player:
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

    def index(self, item: Player, start: int = 0, stop: Optional[int] = None) -> int:
        """Поиск индекса первого вхождения элемента."""
        stop = stop if stop is not None else len(self)
        for i in range(start, stop):
            if i < len(self) and self[i] == item:
                return i
        return None

    def count(self, item: Player) -> int:
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

    def __getitem__(self, key: Union[int, slice]) -> Player:
        """Получение элемента по индексу или срезу."""
        if isinstance(key, slice):
            # Обработка среза
            start, stop, step = key.indices(len(self))
            result = []
            for i in range(start, stop, step):
                self.cursor.execute(
                    f"SELECT * FROM {self.table_name} ORDER BY id LIMIT 1 OFFSET ?",
                    (i,)
                )
                row = self.cursor.fetchone()
                if row:
                    columns = [description[0] for description in self.cursor.description]
                    data_dict = dict(zip(columns, row))
                    player = Player(**data_dict)
                    result.append(player)
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
                columns = [description[0] for description in self.cursor.description]
                data_dict = dict(zip(columns, row))
                return Player(**data_dict)
            return None
        elif isinstance(key, str):
            print("getitem from db with key: ", key, type(key))
            # Обработка индекса
            self.cursor.execute(
                f"SELECT * FROM {self.table_name} WHERE username = ?",
                (key,)
            )
            row = self.cursor.fetchone()
            if row:
                columns = [description[0] for description in self.cursor.description]
                data_dict = dict(zip(columns, row))
                return Player(**data_dict)
            return None
        else:
            return None

    def __setitem__(self, key: Union[int, slice], value: Player) -> None:
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
                data_dict = asdict(value)
                columns = ', '.join([f"{key} = ?" for key in data_dict.keys()])
                values = tuple(data_dict.values()) + (row[0],)
                self.cursor.execute(
                    f"UPDATE {self.table_name} SET {columns} WHERE id = ?",
                    values
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
                f"SELECT id FROM {self.table_name} ORDER BY id LIMIT 1 OFFSET ?",
                (index,)
            )
            row = self.cursor.fetchone()

            if row:
                self.cursor.execute(
                    f"DELETE FROM {self.table_name} WHERE id = ?",
                    (row[0],)
                )
                self.conn.commit()

    def __contains__(self, item: Player) -> bool:
        """Проверка наличия элемента."""
        # Получаем id элемента
        self.cursor.execute(
            f"SELECT id FROM {self.table_name} WHERE username = ?",
            (item.username,)
        )
        row = self.cursor.fetchone()

        if row:
            return True
        return False

    def __iter__(self) -> Iterator[Player]:
        """Итератор по элементам."""
        self.cursor.execute(f"SELECT * FROM {self.table_name} ORDER BY id")
        for row in self.cursor.fetchall():
            columns = [description[0] for description in self.cursor.description]
            data_dict = dict(zip(columns, row))
            yield Player(**data_dict)  # изменено: создание через dataclass

    def __reversed__(self) -> Iterator[Player]:
        """Обратный итератор."""
        self.cursor.execute(f"SELECT * FROM {self.table_name} ORDER BY id DESC")
        for row in self.cursor.fetchall():
            columns = [description[0] for description in self.cursor.description]
            data_dict = dict(zip(columns, row))
            yield Player(**data_dict)  # изменено: создание через dataclass

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


class ExtendableTimer:
    def __init__(self, interval, function, args=None, kwargs=None):
        self.interval = interval
        self.function = function
        self.args = args if args is not None else []
        self.kwargs = kwargs if kwargs is not None else {}
        self.timer = None
        self.start_time = None

    def start(self):
        self.start_time = time.time()
        self.timer = threading.Timer(self.interval, self.function, self.args, self.kwargs)
        self.timer.start()

    def extend(self, additional_seconds):
        if self.timer and self.timer.is_alive():
            # Вычисляем сколько времени осталось
            elapsed = time.time() - self.start_time
            remaining = self.interval - elapsed

            # Отменяем текущий таймер
            self.timer.cancel()

            # Создаем новый таймер с увеличенным временем
            new_interval = remaining + additional_seconds
            self.interval = elapsed + new_interval  # Обновляем общее время
            self.timer = threading.Timer(new_interval, self.function, self.args, self.kwargs)
            self.timer.start()

    def cancel(self):
        if self.timer:
            self.timer.cancel()
