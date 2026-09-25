export const code31 = {
    name: "array_index_evaluated_once",
    code: `DECLARE calls: INTEGER
DECLARE a: ARRAY[0:1] OF INTEGER
FUNCTION next() RETURNS INTEGER
    calls <- calls + 1
    RETURN 0
ENDFUNCTION
a[next()] <- 7
OUTPUT calls
OUTPUT a[0]`,
    input: [],
    expected: [1, 7],
    error: [],
};
