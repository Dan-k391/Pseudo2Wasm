export const code10 = {
    name: "sort_array",
    code: `DECLARE arr : ARRAY[1: 10] OF INTEGER    
DECLARE len : INTEGER
len <- 10

TYPE intptr = ^INTEGER

PROCEDURE Sort(arr: intptr, len: INTEGER)
    DECLARE i : INTEGER
    DECLARE j : INTEGER
    DECLARE temp : INTEGER
    FOR i <- 1 TO len
        FOR j <- 1 TO len - i
            IF arr[j] > arr[j + 1] THEN
                temp <- arr[j]
                arr[j] <- arr[j + 1]
                arr[j + 1] <- temp
            ENDIF
        NEXT j
    NEXT i
ENDPROCEDURE

DECLARE i: INTEGER
FOR i <- 1 TO len
    arr[i] <- RAND(len)
NEXT i

CALL Sort(arr, len)
OUTPUT arr[1]
    `,
    input: [],
    expected: [1],
    // cannot be used yet
    error: [],
};
