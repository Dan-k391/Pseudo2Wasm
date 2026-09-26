import { inputInteger, logInteger } from "./host";
function fib(n: i32): i32 {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}
export function run(): void {
    const n = inputInteger();
    const seed = inputInteger();
    logInteger(fib(n + seed % 3));
}
