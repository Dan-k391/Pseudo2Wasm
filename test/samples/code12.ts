export const code12 = {
    name: "function_array_starting_from_index_3",
    code: `DECLARE i: ARRAY[3: 10] OF INTEGER

FUNCTION f(x: ARRAY[3: 10] OF INTEGER) RETURNS INTEGER
    RETURN x[7] + x[8]
ENDFUNCTION

INPUT i[7]
INPUT i[8]
OUTPUT f(i)
    `,
    input: [45, 21],
    expected: [66],
    // cannot be used yet
    error: [],
};
