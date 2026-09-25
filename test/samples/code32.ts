export const code32 = {
    name: "case_first_matching_range_wins",
    code: `DECLARE choice: INTEGER
choice <- 3
CASE OF choice
    1 TO 3 : OUTPUT 11
    3 : OUTPUT 22
    OTHERWISE : OUTPUT 33
ENDCASE`,
    input: [], expected: [11], error: [],
};
