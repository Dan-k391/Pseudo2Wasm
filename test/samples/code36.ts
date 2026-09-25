export const code36 = {
    name: "case_return_all_paths",
    code: `FUNCTION choose(x: INTEGER) RETURNS INTEGER
CASE OF x
    1 : RETURN 11
    OTHERWISE : RETURN 22
ENDCASE
ENDFUNCTION
OUTPUT choose(2)`,
    input: [], expected: [22], error: [],
};
