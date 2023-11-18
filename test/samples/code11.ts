export const code11 = {
    name: "array2ptr",
    code: `DECLARE i: INTEGER

FOR i <- 1 TO 11
    OUTPUT i
NEXT i
    `,
    input: [],
    expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // cannot be used yet
    error: [],
};
