export const code20 = {
    name: "array_out_of_bounds_write",
    code: `DECLARE a: ARRAY[2:3] OF INTEGER
a[1] <- 99`,
    input: [],
    expected: [],
    error: ["Array index 1 outside [2:3]", "line 2:"],
};
