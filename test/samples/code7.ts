export const code7 = {
    name: "array",
    code: `DECLARE arr: ARRAY[1: 100000] OF REAL
DECLARE n: INTEGER
n <- 100000
DECLARE i: INTEGER

FOR i <- 1 TO n
    arr[i] <- RAND(n)
NEXT i
    `,
    input: [],
    expected: [],
    // cannot be used yet
    error: [],
};
