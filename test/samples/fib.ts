export const fib = {
    name: "fib",
    code: `
FUNCTION aux(n: INTEGER, a: INTEGER, b: INTEGER) RETURNS INTEGER
    WHILE n > 0
        DECLARE c: INTEGER
        c <- a + b
        a <- b
        b <- c
        n <- n - 1
    ENDWHILE
    RETURN a
ENDFUNCTION

DECLARE i: INTEGER
FOR i <- 0 TO 10000000
    aux(46, 0, 1)
NEXT i

aux(46, 0, 1)
    `,
    input: [],
    expected: [1836311903],
    // cannot be used yet
    error: [],
};
