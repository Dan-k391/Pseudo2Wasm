import { inputInteger, logInteger } from "./host";
function kernel(n: i32, seed: i32): i32 {
    let state = seed;
    for (let i = 0; i < n; ++i) state = (state * 17 + 23) % 65521;
    return state;
}
export function run(): void {
    const n = inputInteger();
    const seed = inputInteger();
    logInteger(kernel(n, seed));
}
