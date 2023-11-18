export const code8 = {
    name: "array2ptr",
    code: `TYPE realptr = ^REAL
DECLARE i: ARRAY[0: 10] OF REAL
DECLARE j: realptr

INPUT i[0]
j <- i
OUTPUT j^
    `,
    input: [22.9],
    expected: [22.9],
    // cannot be used yet
    error: [],
};
