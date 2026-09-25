export const code35 = {
    name: "case_real_range_and_negative_literal",
    code: `DECLARE choice: REAL
choice <- -1.5
CASE OF choice
    -2.0 TO -1.0 : OUTPUT 11
    OTHERWISE : OUTPUT 33
ENDCASE`,
    input: [], expected: [11], error: [],
};
