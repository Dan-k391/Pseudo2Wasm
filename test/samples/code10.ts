export const code10 = {
    name: "sort_array",
    code: `DECLARE arr : ARRAY[0: 99999] OF INTEGER    
DECLARE len : INTEGER
len <- 100000

TYPE intptr = ^INTEGER

PROCEDURE qsort(arr: intptr, start: INTEGER, end: INTEGER)
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

        CALL qsort(arr, start, left - 1)
        CALL qsort(arr, left + 1, end)
    ENDIF
ENDPROCEDURE

DECLARE i: INTEGER
FOR i <- 0 TO len - 1
    arr[i] <- RAND(len - 1)
NEXT i

CALL STARTTIME()
CALL qsort(arr, 0, len - 1)
CALL ENDTIME()
    `,
    input: [],
    expected: [],
    // cannot be used yet
    error: [],
};
