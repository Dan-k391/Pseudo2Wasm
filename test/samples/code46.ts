export const code46 = {
    name: "stack_frame_exact_fit",
    code: `FUNCTION fit() RETURNS INTEGER
    DECLARE a: ARRAY[0:131070] OF INTEGER
    a[131070] <- 7
    RETURN a[131070]
ENDFUNCTION
OUTPUT fit(), fit()`,
    input: [], expected: [7, 7], error: [],
};
