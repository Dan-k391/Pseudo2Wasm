export const code42 = {
    name: "descending_for_inclusive",
    code: `DECLARE i: INTEGER
FOR i <- 5 TO 1 STEP -2
    OUTPUT i
NEXT i`,
    input: [], expected: [5, 3, 1], error: [],
};
