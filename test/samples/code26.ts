export const code26 = {
    name: "null_pointer_write",
    code: `TYPE intptr = ^INTEGER
DECLARE p: intptr
p^ <- 7`,
    input: [],
    expected: [],
    error: ["Null pointer dereference", "line 3:"],
};
