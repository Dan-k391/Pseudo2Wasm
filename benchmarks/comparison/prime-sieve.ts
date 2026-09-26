import { inputInteger, logInteger } from "./host";
const marked = new StaticArray<i32>(8192);
function kernel(n: i32, seed: i32): i32 {
    const limit = n + seed % 31;
    for (let i = 0; i <= limit; ++i) marked[i] = 0;
    for (let i = 2; i * i <= limit; ++i) {
        if (marked[i] == 0) {
            for (let j = i * i; j <= limit; j += i) marked[j] = 1;
        }
    }
    let count = 0;
    for (let i = 2; i <= limit; ++i) if (marked[i] == 0) ++count;
    return count;
}
export function run(): void {
    const n = inputInteger();
    const seed = inputInteger();
    logInteger(kernel(n, seed));
}
