// Intentionally bounded inputs: no signed overflow or out-of-bounds C accesses.
// References are JS correctness oracles, not a timed JavaScript competitor.
export const workloads = [
    {
        name: "integer-recurrence", n: 200000,
        edges: [[0, 1], [1, 17], [100, 123]],
        reference(n, seed) {
            let state = seed;
            for (let i = 0; i < n; i++) state = (state * 17 + 23) % 65521;
            return state;
        },
    },
    {
        name: "prime-sieve", n: 4000,
        edges: [[0, 0], [2, 0], [8191, 0]],
        reference(n, seed) {
            let count = 0;
            // Trial division is deliberately independent of the measured sieve.
            for (let value = 2; value <= n + seed % 31; value++) {
                let prime = true;
                for (let d = 2; d * d <= value; d++) {
                    if (value % d === 0) { prime = false; break; }
                }
                if (prime) count++;
            }
            return count;
        },
    },
    {
        name: "matrix-multiply", n: 24,
        edges: [[0, 0], [1, 17], [32, 123]],
        reference(n, seed) {
            let total = 0;
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    for (let k = 0; k < n; k++) {
                        total += ((i * n + k + seed) % 97) * (((k * n + j) * 3 + seed) % 89);
                    }
                }
            }
            return total;
        },
    },
    {
        name: "recursive-fibonacci", n: 22,
        edges: [[0, 0], [1, 0], [10, 2]],
        reference(n, seed) {
            let a = 0, b = 1;
            for (let i = 0; i < n + seed % 3; i++) [a, b] = [b, a + b];
            return a;
        },
    },
];

export function casesFor(workload) {
    return [1, 17, 123, 9].map(seed => ({
        n: workload.n, seed, expected: workload.reference(workload.n, seed),
    }));
}
