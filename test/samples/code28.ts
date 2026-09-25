export const code28 = {
    name: "recursive_stack_limit",
    code: `FUNCTION recurse(n: INTEGER) RETURNS INTEGER
    DECLARE a: ARRAY[0:100000] OF INTEGER
    IF n > 0 THEN
        RETURN recurse(n - 1)
    ENDIF
    RETURN 0
ENDFUNCTION
OUTPUT recurse(2)`,
    input: [],
    expected: [],
    error: ["Stack memory limit exceeded"],
};
