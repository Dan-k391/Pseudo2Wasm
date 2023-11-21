export const code11 = {
    name: "function_array",
    code: `DECLARE i: ARRAY[0: 10] OF INTEGER

FUNCTION f(x: ARRAY[0: 10] OF INTEGER) RETURNS INTEGER
    RETURN x[0]
ENDFUNCTION

INPUT i[0]
OUTPUT f(i)
    `,
    input: [22],
    expected: [22],
    // cannot be used yet
    error: [],
};
