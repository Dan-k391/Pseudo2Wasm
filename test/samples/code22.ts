export const code22 = {
    name: "multidimensional_nonzero_bounds",
    code: `DECLARE a: ARRAY[2:3, 5:6] OF INTEGER
a[3,6] <- 17
OUTPUT a[3,6]`,
    input: [],
    expected: [17],
    error: [],
};
