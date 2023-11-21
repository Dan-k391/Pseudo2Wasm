export const code10 = {
    name: "sort_array",
    code: `DECLARE arr : ARRAY[0: 9] OF INTEGER    
DECLARE len : INTEGER
len <- 10000

TYPE intptr = ^INTEGER

PROCEDURE Sort(arr: intptr, start: INTEGER, end: INTEGER)
    IF start < end THEN
        DECLARE pivot: INTEGER
        pivot <- arr[start]
        DECLARE left: INTEGER
        left <- start
        DECLARE right: INTEGER
        right <- end

        WHILE left < right
            WHILE left < right AND arr[right] >= pivot
                right <- right - 1
            ENDWHILE
            arr[left] <- arr[right]

            WHILE left < right AND arr[left] <= pivot
                left <- left + 1
            ENDWHILE
            arr[right] <- arr[left]
        ENDWHILE
        arr[left] <- pivot

        CALL Sort(arr, start, left - 1)
        CALL Sort(arr, left + 1, end)
    ENDIF
ENDPROCEDURE

DECLARE i: INTEGER
FOR i <- 0 TO len
    arr[i] <- RAND(len)
NEXT i

CALL Sort(arr, 0, len)
OUTPUT arr[0]
    `,
    input: [],
    expected: [0],
    // cannot be used yet
    error: [],
};
