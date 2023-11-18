export const code9 = {
    name: "function_array",
    code: `TYPE intptr = ^INTEGER
DECLARE i: ARRAY[0: 10] OF INTEGER

FUNCTION f(x: intptr) RETURNS INTEGER
    RETURN x^
ENDFUNCTION

INPUT i[0]
OUTPUT f(i)
    `,
    input: [33],
    expected: [33],
    // cannot be used yet
    error: [],
};
