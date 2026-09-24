export const code16 = {
    name: "return_string_literal",
    code: `FUNCTION f() RETURNS STRING
    RETURN "shit"
ENDFUNCTION

OUTPUT f()
    `,
    input: [],
    expected: ["shit"],
    error: [],
};
