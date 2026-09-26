import { inputInteger, logInteger } from "./host";
const columns = new StaticArray<i32>(12);
const rising = new StaticArray<i32>(23);
const falling = new StaticArray<i32>(23);
function search(row: i32, n: i32, shift: i32): i32 {
    if (row == n) return 1;
    let total = 0;
    for (let choice = 0; choice < n; ++choice) {
        const col = (choice + shift) % n;
        const up = row + col, down = row - col + n - 1;
        if (columns[col] == 0 && rising[up] == 0 && falling[down] == 0) {
            columns[col] = 1;
            rising[up] = 1;
            falling[down] = 1;
            total += search(row + 1, n, shift);
            columns[col] = 0;
            rising[up] = 0;
            falling[down] = 0;
        }
    }
    return total;
}
export function run(): void {
    const n = inputInteger(), seed = inputInteger();
    for (let i = 0; i < 12; ++i) columns[i] = 0;
    for (let i = 0; i < 23; ++i) { rising[i] = 0; falling[i] = 0; }
    logInteger(search(0, n, seed));
}
