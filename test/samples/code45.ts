export const code45 = {
    name: "pointer_linear_range_does_not_enforce_object_bounds",
    code: `DECLARE first: INTEGER
DECLARE second: INTEGER
PROCEDURE peek(p: ARRAY[0:1] OF INTEGER)
    OUTPUT p[1]
ENDPROCEDURE
first <- 7
second <- 9
CALL peek(^first)`,
    input: [], expected: [9], error: [],
};
