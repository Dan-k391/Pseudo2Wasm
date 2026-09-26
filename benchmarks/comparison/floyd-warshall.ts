import { inputInteger, logInteger } from "./host";
const distances = new StaticArray<i32>(9216);
export function run(): void {
    const n = inputInteger(), seed = inputInteger();
    for (let i = 0; i < n; ++i) {
        for (let j = 0; j < n; ++j) {
            distances[i * n + j] = i == j ? 0 : (i * 17 + j * 31 + seed) % 1000 + 1;
        }
    }
    for (let k = 0; k < n; ++k) {
        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                const candidate = distances[i * n + k] + distances[k * n + j];
                if (candidate < distances[i * n + j]) distances[i * n + j] = candidate;
            }
        }
    }
    let total = 0;
    for (let i = 0; i < n * n; ++i) total += distances[i];
    logInteger(total);
}
