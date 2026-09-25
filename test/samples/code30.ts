export const code30 = {
    name: "array_parameter_bounds",
    code: `FUNCTION read(a: ARRAY[3:4] OF INTEGER) RETURNS INTEGER
    RETURN a[5]
ENDFUNCTION
DECLARE values: ARRAY[3:4] OF INTEGER
OUTPUT read(values)`,
    input: [],
    expected: [],
    error: ["Array index 5 outside [3:4]", "line 2:"],
};
