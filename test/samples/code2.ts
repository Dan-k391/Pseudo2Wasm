export const code2 = {
    name: "function",
    code: `
FUNCTION pow(base:REAL, exp:INTEGER) RETURNS REAL
    DECLARE ans: REAL
    DECLARE i: INTEGER
    ans <- 1
    FOR i <- 1 TO exp
        ans <- ans * base
    NEXT i
    RETURN ans
ENDFUNCTION

    
DECLARE i: INTEGER
DECLARE j: REAL
DECLARE k: INTEGER

INPUT i
INPUT j
INPUT k
OUTPUT i + pow(j, k)
    `,
    input: [3, 3.14, 2],
    // floatring point inaccuracy
    expected: [3 + Math.pow(3.14, 2)],
    // cannot be used yet
    error: [],
};
