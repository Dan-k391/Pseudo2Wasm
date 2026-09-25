export const code38 = {
    name: "record_value_copy",
    code: `TYPE Pair
    DECLARE x: INTEGER
    DECLARE y: REAL
ENDTYPE
DECLARE a: Pair
DECLARE b: Pair
a.x <- 5
a.y <- 2.5
b <- a
a.x <- 9
OUTPUT b.x, b.y, a.x`,
    input: [], expected: [5, 2.5, 9], error: [],
};
