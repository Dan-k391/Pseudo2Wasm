export const code34 = {
    name: "case_otherwise_and_character_range",
    code: `DECLARE choice: CHAR
choice <- 'Z'
CASE OF choice
    'A' TO 'C' : OUTPUT 11
    OTHERWISE : OUTPUT 33
ENDCASE`,
    input: [], expected: [33], error: [],
};
