export const code33 = {
    name: "case_no_match_continues",
    code: `DECLARE choice: INTEGER
choice <- 9
CASE OF choice
    1 : OUTPUT 11
    2 : OUTPUT 22
ENDCASE
OUTPUT 44`,
    input: [], expected: [44], error: [],
};
