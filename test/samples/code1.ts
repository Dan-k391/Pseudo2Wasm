export const code1 = {
    name: "input",
    code: `DECLARE i: INTEGER
DECLARE j: INTEGER
DECLARE k: REAL

INPUT i
INPUT j
INPUT k
OUTPUT i + j * k
    `,
    input: [3, 2, 3.14],
    // floating point inaccuracy
    expected: [3 + 2 * 3.14],
    // cannot be used yet
    error: [],
};
