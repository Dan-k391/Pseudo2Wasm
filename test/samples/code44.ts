export const code44 = {
    name: "multidimensional_first_index_out_of_bounds",
    code: `DECLARE a: ARRAY[2:3, 5:6] OF INTEGER
a[4,5] <- 1`,
    input: [], expected: [], error: ["Array index 4 outside [2:3]", "line 2:"],
};
