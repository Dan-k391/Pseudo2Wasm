export const code0 = {
    name: "declare",
    code: `DECLARE i: INTEGER
DECLARE j: INTEGER
DECLARE k: REAL

i <- 1
j <- 2
k <- 3.14
OUTPUT i + j * k
    `,
    input: [],
    expected: [7.28],
    // cannot be used yet
    error: [],
};
