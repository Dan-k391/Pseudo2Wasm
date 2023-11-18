# OAC

## About

OAC (Oh a compiler)
Inspired by zjj
灵感来源于zjj


### Pseudo2Wasm
Is an improvement to OAC(Web version),
adds an IR generation layer implemented with binaryen.
still in progress

### How it works
This compiler, compiles CAIE PseudoCode into WebAssembly.
It uses the following process.
1. Lexical Analysis
2. Syntax Analysis
3. Semantic Analysis(Type Check)
4. IR Generation(with binaryen)
5. Code Generation
6. Optimization
7. Runtime

The semantic analysis is very basic and currently only has type check and validation(like those stuff).

### RoadMap
- [x] OUTPUT
- [x] 变量操作
- [x] IF
- [x] 循环 (WHILE, REPEAT, FOR)
- [x] FUNCTION & PROCEDURE 
- [x] 优先实现CHAR
确实，得先实现数组和字符串，再搞指针
- [x] 数组和字符串
就快实现数组了，现在遇到一个问题
是否加入语义分析模块（虽然加入这个项目做到后期肯定会加）
比如数组越界等问题就很棘手，当然可以直接让数组第一位存长度
但这样太麻烦了，让整个编译器好像是半静态半动态内存一样
比如在wasm中判断是否越界就又要考虑报错方法加入abort函数
然后考虑是否将整个过程整合成单独的wasm函数，实在不伦不类
所以目前的数组是静态的，所有的长度以及大小都是固定生成
- [x] 指针
- [ ] 文件操作
- [x] 结构体

- [x] INPUT

## Precautions

***This compiler treats PseudoCode as a totally static typed language(I tried to make most of the standards same as C)***

So, for example
```
DECLARE i: ARRAY[0: 9] OF INTEGER

i[10] <- 20
```
This is **ALLOWED** for this compiler(at least currently).
I may add a more sophisticated semantic analyzer in the future.....Well lets see.

***I changed the type system into a where all basic types(except strings) can compat with each other***
```
OUTPUT 'a' > 3.5
```
This is **ALLOWED** for this compiler.

## Basic Grammar

#### Comments
```
// This is a comment
```

#### Declarations

***Look for examples here***

```
// Variable declaration
DECLARE <Identifier>: <Type>
// Array declaration
DECLARE <Identifier>: ARRAY[<Upper>: <Lower>] OF <Type>

// Examples
DECLARE i: INTEGER
DECLARE j: ARRAY[0: 9] OF INTEGER
```
Only supports static length arrays.

#### Assignments
```
<Expression> <- <Expression>

// Examples
i <- 9
j[2] <- 3
k.y <- 4.1
f <- 'd'
```
The type of right side of the assignment is resolved and the compiler attempts to convert it to the type of the left hand side and assigns the value to it.

**Implicit type conversion**

All basic types except STRINGs (INTEGER, REAL, CHAR, BOOLEAN) can interconvert with each other.

INTEGER, CHAR and BOOLEAN are all i32 types after converted to wasm. REAL is f64.

#### If statements
```
IF <Expression> THEN
    <Statements>
ELSE
    <Statements>
ENDIF

// Examples
IF 1 > 2 THEN
    OUTPUT 'a'
ELSE
    OUTPUT 'b'
ENDIF
```

#### While loop
```
WHILE <Expression>
    <Statements>
ENDWHILE

// Examples
WHILE i < 10
    OUTPUT i
    i <- i + 1
ENDWHILE
```

#### For loop
```
// The default step is 1
FOR <Identifier> <- <Int_Expr> TO <Int_Expr>
    <Statements>
NEXT <Identifier>

// Use step
FOR <Identifier> <- <Int_Expr> TO <Int_Expr> STEP <Int_Expr>
    <Statements>
NEXT <Identifier>

// Examples
FOR i <- 0 TO 10
    OUTPUT i
NEXT i

FOR i <- 0 TO 10 STEP 2
    OUTPUT i
NEXT i
```
Before performing a for loop on a variable, you have to declare it first.

The start and end of the loop are inclusive, and has to be integer expressions.

#### Function/Procedure definitions
```
FUNCTION <Identifier> (<Params>) RETURNS <Type>
    <Statements>
ENDFUNCTION

PROCEDURE <Identifier> (<Params>)
    <Statements>
ENDPROCEDURE

// Param passtype is default BYVAL
FUNCTION foo (i: INTEGER) RETURNS INTEGER
    RETURN i
ENDFUNCTION

// BYREF passes the reference of the object
PROCEDURE foo (BYREF: i: INTEGER)
    i <- i + 1
ENDPROCEDURE

// Examples
FUNCTION foo (i: INTEGER, j: INTEGER) RETURNS INTEGER
    RETURN i + j
ENDFUNCTION

PROCEDURE foo (i: INTEGER, j: INTEGER)
    OUTPUT i + j
ENDPROCEDURE
```

#### User-defined data types
RECORDs:
```
TYPE <Identifier> 
    <Declarations>
ENDTYPE

// Examples
TYPE Point
    DECLARE x: INTEGER
    DECLARE y: INTEGER
ENDTYPE

DECLARE p: Point
p.x <- 1
p.y <- 2

OUTPUT p.x + p.y
```
POINTERs:
```
TYPE <Identifier> = ^<TYPE>

// Examples
TYPE intptr = ^INTEGER
DECLARE i: INTEGER
DECLARE a: intptr

i <- 19
a <- ^i
OUTPUT a^
OUTPUT (a + 1)^
```
You can perform pointer arithmetic on pointers. But the pointer has to be on the left side of the operator.

#### Case
```
CASE OF <Identifier>
    <Value>: <Statements>;
    <Value>: <Statements>;
    ...
ENDCASE
```
Not implemented because i don't want to.
***Theoretically,***
***At the end of each statement, you have to put a semicolon.***
***Just don't use this lol.***

#### Output
```
OUTPUT <Expression>

// Examples
OUTPUT 'a'
```

Currently OUTPUT supports whatever basic type.

#### Input
```
INPUT <Expression>

// Examples
INPUT i
```

Currently INPUT supports whatever basic type. (Strings are not supported yet)

