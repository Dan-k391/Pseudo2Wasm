export const code23 = {
    name: "null_pointer_dereference",
    code: `TYPE intptr = ^INTEGER
DECLARE p: intptr
OUTPUT p^`,
    input: [],
    expected: [],
    error: ["Null pointer dereference", "line 3:"],
};
