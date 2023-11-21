export const code10 = {
    name: "sort_array",
    code: `DECLARE arr : ARRAY[0: 9] OF INTEGER    
DECLARE len : INTEGER
len <- 10

TYPE intptr = ^INTEGER

PROCEDURE Sort(arr: intptr, len: INTEGER)
    DECLARE i : INTEGER
    DECLARE j : INTEGER
    DECLARE temp : INTEGER
    FOR i <- 0 TO len - 1
        FOR j <- 0 TO len - i - 1
            IF arr[j] > arr[j + 1] THEN
                temp <- arr[j]
                arr[j] <- arr[j + 1]
                arr[j + 1] <- temp
            ENDIF
        NEXT j
    NEXT i
ENDPROCEDURE

DECLARE i: INTEGER
FOR i <- 0 TO len - 1
    arr[i] <- RAND(len - 1)
NEXT i

CALL Sort(arr, len)
FOR i <- 0 TO len - 1
    OUTPUT arr[i]
NEXT i
    `,
    input: [],
    expected: [],
    // cannot be used yet
    error: [],
};
