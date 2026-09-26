import { inputInteger, logInteger } from "./host";
const a = new StaticArray<i32>(1024);
const b = new StaticArray<i32>(1024);
const c = new StaticArray<i32>(1024);
function kernel(n: i32, seed: i32): i32 {
    for (let i = 0; i < n * n; ++i) {
        a[i] = (i + seed) % 97;
        b[i] = (i * 3 + seed) % 89;
    }
    for (let i = 0; i < n; ++i) {
        for (let j = 0; j < n; ++j) {
            let cell = 0;
            for (let k = 0; k < n; ++k) cell += a[i * n + k] * b[k * n + j];
            c[i * n + j] = cell;
        }
    }
    let total = 0;
    for (let i = 0; i < n * n; ++i) total += c[i];
    return total;
}
export function run(): void {
    const n = inputInteger();
    const seed = inputInteger();
    logInteger(kernel(n, seed));
}
