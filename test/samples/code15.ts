export const code15 = {
    name: "pass_strings",
    code: `FUNCTION f(x: STRING) RETURNS STRING
    RETURN x
ENDFUNCTION

DECLARE s: STRING
INPUT s
OUTPUT f(s)
    `,
    input: ["hello"],
    expected: ["hello"],
    // cannot be used yet
    error: [],
};
