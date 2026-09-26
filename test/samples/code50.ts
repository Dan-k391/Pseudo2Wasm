export const code50 = {
    name: "async_input_early_returns_share_cleanup",
    code: `FUNCTION choose() RETURNS INTEGER
DECLARE n: INTEGER
INPUT n
IF n < 0 THEN
RETURN n
ENDIF
IF n = 0 THEN
RETURN 100
ENDIF
RETURN n + 1
ENDFUNCTION
OUTPUT choose(), choose(), choose()`,
    input: [-2, 0, 7],
    expected: [-2, 100, 8],
    error: [],
};
