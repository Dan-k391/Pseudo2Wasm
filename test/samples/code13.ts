export const code13 = {
    name: "nested_records",
    code: `TYPE one
    DECLARE x: INTEGER
ENDTYPE

TYPE two
    DECLARE a: INTEGER
    DECLARE c: one
ENDTYPE

DECLARE t: two

INPUT t.a
INPUT t.c.x

OUTPUT t.a + t.c.x
    `,
    input: [3, 4],
    expected: [7],
    // cannot be used yet
    error: [],
};
