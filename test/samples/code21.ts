export const code21 = {
    name: "array_out_of_bounds_read",
    code: `DECLARE a: ARRAY[2:3] OF INTEGER
OUTPUT a[4]`,
    input: [],
    expected: [],
    error: ["Array index 4 outside [2:3]", "line 2:"],
};
