export const code14 = {
    name: "char_operations",
    code: `DECLARE c1: CHAR
DECLARE c2: CHAR

INPUT c1
INPUT c2

OUTPUT UCASE(c1)
OUTPUT LCASE(c2)
    `,
    input: ['a', 'B'],
    expected: ['A', 'b'],
    // cannot be used yet
    error: [],
};
