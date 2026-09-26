import { inputInteger, logInteger } from "./host";
const values = new StaticArray<i32>(16384);
function sift(start: i32, finish: i32): void {
    let root = start;
    while (root * 2 + 1 <= finish) {
        let child = root * 2 + 1;
        if (child < finish) {
            if (values[child] < values[child + 1]) ++child;
        }
        if (values[root] < values[child]) {
            const temp = values[root];
            values[root] = values[child];
            values[child] = temp;
            root = child;
        } else root = finish;
    }
}
export function run(): void {
    const n = inputInteger(), seed = inputInteger();
    let state = seed;
    for (let i = 0; i < n; ++i) {
        state = (state * 17 + 23) % 65521;
        values[i] = state;
    }
    for (let i = n / 2 - 1; i >= 0; --i) sift(i, n - 1);
    for (let i = n - 1; i > 0; --i) {
        const temp = values[0];
        values[0] = values[i];
        values[i] = temp;
        sift(0, i - 1);
    }
    let checksum = 0;
    for (let i = 0; i < n; ++i) checksum = (checksum * 17 + values[i]) % 65521;
    logInteger(checksum);
}
