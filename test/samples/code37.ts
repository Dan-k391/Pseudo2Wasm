export const code37 = {
    name: "array_value_copy",
    code: `DECLARE a: ARRAY[1:2] OF INTEGER
DECLARE b: ARRAY[3:4] OF INTEGER
a[1] <- 7
a[2] <- 8
b <- a
a[1] <- 9
OUTPUT b[3], b[4], a[1]`,
    input: [], expected: [7, 8, 9], error: [],
};
