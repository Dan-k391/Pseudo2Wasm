export const code41 = {
    name: "byref_mutates_caller_byval_does_not",
    code: `DECLARE x: INTEGER
PROCEDURE update(BYREF target: INTEGER, BYVAL copy: INTEGER)
    target <- target + 3
    copy <- 99
ENDPROCEDURE
x <- 4
CALL update(x, x)
OUTPUT x`,
    input: [], expected: [7], error: [],
};
