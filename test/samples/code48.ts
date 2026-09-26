export const code48 = {
    name: "parameter_values_across_async_input",
    code: `FUNCTION addAfterInput(value: REAL, count: INTEGER) RETURNS REAL
    DECLARE extra: INTEGER
    INPUT extra
    OUTPUT count
    RETURN value + extra
ENDFUNCTION
FUNCTION replace(value: INTEGER) RETURNS INTEGER
    INPUT value
    RETURN value
ENDFUNCTION
OUTPUT addAfterInput(1.5, 2), replace(0)`,
    input: [7, 9], expected: [2, 8.5, 9], error: [],
};
