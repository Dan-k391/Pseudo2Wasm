export const code29 = {
    name: "loop_local_frame_allocated_once",
    code: `FUNCTION count() RETURNS INTEGER
    DECLARE i: INTEGER
    DECLARE total: INTEGER
    total <- 0
    FOR i <- 1 TO 1000
        DECLARE value: INTEGER
        value <- 1
        total <- total + value
    NEXT i
    RETURN total
ENDFUNCTION
OUTPUT count()`,
    input: [],
    expected: [1000],
    error: [],
};
