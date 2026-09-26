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
    {
        name: "n-queens", n: 11,
        edges: [[0, 0], [1, 0], [4, 0], [5, 17], [8, 9], [12, 123]],
        reference(n, seed) {
            // Independent bitset search, not the timed three-array algorithm.
            const mask = (1 << n) - 1;
            function visit(columns, left, right) {
                if (columns === mask) return 1;
                let free = mask & ~(columns | left | right), total = 0;
                while (free) {
                    const bit = free & -free;
                    free -= bit;
                    total += visit(columns | bit, ((left | bit) << 1) & mask, (right | bit) >>> 1);
                }
                return total;
            }
            return visit(0, 0, 0);
        },
    },
    {
        name: "heap-sort", n: 16384,
        edges: [[0, 0], [1, 17], [2, 123], [127, 9], [16384, 0]],
        reference(n, seed) {
            const values = [];
            let state = seed;
            for (let i = 0; i < n; i++) {
                state = (state * 17 + 23) % 65521;
                values.push(state);
            }
            values.sort((a, b) => a - b);
            return values.reduce((checksum, value) => (checksum * 17 + value) % 65521, 0);
        },
    },
    {
        name: "floyd-warshall", n: 96,
        edges: [[0, 0], [1, 17], [2, 0], [16, 123], [96, 0]],
        reference(n, seed) {
            // Repeated dense Dijkstra is independent of Floyd-Warshall.
            let total = 0;
            for (let source = 0; source < n; source++) {
                const distance = Array(n).fill(Infinity), visited = Array(n).fill(false);
                distance[source] = 0;
                for (let step = 0; step < n; step++) {
                    let best = -1;
                    for (let v = 0; v < n; v++) {
                        if (!visited[v] && (best < 0 || distance[v] < distance[best])) best = v;
                    }
                    visited[best] = true;
                    for (let v = 0; v < n; v++) {
                        const weight = best === v ? 0 : (best * 17 + v * 31 + seed) % 1000 + 1;
                        distance[v] = Math.min(distance[v], distance[best] + weight);
                    }
                }
                total += distance.reduce((sum, value) => sum + value, 0);
            }
            return total;
        },
    },
];

export function casesFor(workload) {
    return [1, 17, 123, 9].map(seed => ({
        n: workload.n, seed, expected: workload.reference(workload.n, seed),
    }));
}
