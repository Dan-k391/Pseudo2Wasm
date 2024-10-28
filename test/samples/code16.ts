export const code16 = {
    name: "pass_strings",
    code: `FUNCTION f() RETURNS STRING
    RETURN "shit"
ENDFUNCTION

OUTPUT f()
    `,
    input: ["shit"],
    expected: ["shit"],
    // cannot be used yet
    error: [],
};
