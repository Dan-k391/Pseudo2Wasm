export const code49 = {
    name: "promoted_mutable_locals_across_async_input",
    code: `FUNCTION read(n: INTEGER) RETURNS REAL
DECLARE total: REAL
DECLARE text: STRING
DECLARE yes: BOOLEAN
total <- n * 1.5
INPUT n
INPUT text
INPUT yes
IF yes THEN
    total <- total + n
ENDIF
OUTPUT text, n, yes
RETURN total
ENDFUNCTION
OUTPUT read(2), read(4)`,
    input: [7, "héllo", "TRUE", 8, "again", "FALSE"],
    expected: ["héllo", 7, "TRUE", 10, "again", 8, "FALSE", 6],
    error: [],
};
