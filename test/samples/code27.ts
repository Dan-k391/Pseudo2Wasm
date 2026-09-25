export const code27 = {
    name: "multidimensional_out_of_bounds",
    code: `DECLARE a: ARRAY[2:3, 5:6] OF INTEGER
OUTPUT a[2,7]`,
    input: [],
    expected: [],
    error: ["Array index 7 outside [5:6]", "line 2:"],
};
