export const code4 = {
    name: "bool_input",
    code: `DECLARE t: BOOLEAN

INPUT t
IF t THEN
    OUTPUT "true bool"
ELSE
    OUTPUT "false bool"
ENDIF
    `,
    input: ["TRUE"],
    expected: ["true bool"],
    // cannot be used yet
    error: [],
};
