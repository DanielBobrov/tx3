// Ultimate Tic-Tac-Toe board: 9x9 (3x3 мини-доски по 3x3)
(function () {
    class Cursor {
        constructor(board) {
            this.board = window.board;
            this.i = 4;
            this.j = 4;
            this.update_cursor();

            addEventListener("keydown", (event) => {
                if (event.code === "KeyW") {this.move_top()}
                else if (event.code === "KeyS") {this.move_bottom()}
                else if (event.code === "KeyA") {this.move_left()}
                else if (event.code === "KeyD") {this.move_right()}
                else if (event.key === "Enter") {this.board.getCell(this.i, this.j).click()}
                else if (event.code.includes("Numpad")) {
                    console.log(event);
                    let numpad_map= {}
                    numpad_map = { ...numpad_map,
                        "Numpad7": [0, 0], "Numpad8": [0, 1], "Numpad9": [0, 2],
                        "Numpad4": [1, 0], "Numpad5": [1, 1], "Numpad6": [1, 2],
                        "Numpad1": [2, 0], "Numpad2": [2, 1], "Numpad3": [2, 2],
                    };
                    let active_mini = this.board.activeMini;
                    let r = Math.floor(active_mini / 3) * 3 + numpad_map[event.code][0];
                    let c = Math.floor(active_mini % 3) * 3 + numpad_map[event.code][1];
                    this.board.getCell(r, c).click();
                }
            })
        }

        move_left() {
            this.j = (this.j + 8) % 9
            this.update_cursor();
        }

        move_right() {
            this.j = (this.j + 10) % 9
            this.update_cursor();
        }

        move_bottom() {
            this.i = (this.i + 10) % 9
            this.update_cursor();
        }

        move_top() {
            this.i = (this.i + 8) % 9
            this.update_cursor();
        }

        update_cursor() {
            for (let i = 0; i < 9; i++) {
                for (let j = 0; j < 9; j++) {
                    let cell = this.board.getCell(i, j);
                    if (i === this.i && j === this.j) {
                        console.log("Added cursor to ", i, j);
                        cell.classList.add("cursor");
                    } else {
                        cell.classList.remove("cursor");
                    }
                }
            }
        }

        set_at(i, j) {
            this.i = i;
            this.j = j;
            this.update_cursor();
        }
    }

    window.Cursor = Cursor;
})();

document.addEventListener("DOMContentLoaded", () => {
    window.cursor = new Cursor(board);
    window.GAME_SOCKET.on('update_state', (state) => {
        let active_mini = state.active_mini;
        let r = Math.floor(active_mini / 3) * 3 + 1;
        let c = Math.floor(active_mini % 3) * 3 + 1;
        cursor.set_at(r, c);
    });
});