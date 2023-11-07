/**
 * Builtin functions, work a little bit different from the user defined functions.
 * For now, it doesn't use the stack and move the stackbase and stacktop pointers.
 * It uses the webassembly traditional params calling and perform operations to
 * the params directly.
 * 
 * (I would probably rewrite the builtin functions in pseudocode, but thats later stuff)
 * 
 * Also, the functions are totally static
 * it depends on none of the class properties
 * the properties in the class just act as an interface when this function is called
 * and an inheratace from base class Function
 */

// 2023/11/6: Now fixed, all type checking is done in the semantic analysis phase
// this is just a holder fo the wasm builtin function

import binaryen from "binaryen";


export abstract class BuiltinFunction {
}

// TODO: use a better way to store builtin functions
export class Length extends BuiltinFunction {
    private module: binaryen.Module;

    constructor(module: binaryen.Module) {
        super();
        this.module = module;
    }

    public generate(): void {
        // in c, this function looks like this
        /**
         * int LENGTH(char *s) {
         *  int i = 0, j = 0;
         *  while (s[i]) {
         *      if ((s[i] & 0xc0) != 0x80) j++;
         *      i++;
         *  }
         *  return j;
         *  }
         */
        this.module.addFunction("LENGTH", binaryen.createType([binaryen.i32]), binaryen.i32, [binaryen.i32, binaryen.i32],
            this.module.block(null, [
                this.module.local.set(1, this.module.local.get(0, binaryen.i32)),
                this.module.local.set(2, this.module.i32.const(0)),
                this.module.loop(
                    "0",
                    this.module.if(
                        this.module.i32.load8_u(0, 1, this.module.local.get(1, binaryen.i32), "0"),
                        this.module.block(null, [
                            this.module.if(
                                this.module.i32.ne(
                                    this.module.i32.and(
                                        this.module.i32.load8_u(0, 1, this.module.local.get(1, binaryen.i32), "0"),
                                        this.module.i32.const(192)
                                    ),
                                    this.module.i32.const(128)
                                ),
                                this.module.local.set(
                                    2,
                                    this.module.i32.add(
                                        this.module.local.get(2, binaryen.i32),
                                        this.module.i32.const(1)
                                    )
                                )
                            ),
                            this.module.local.set(
                                1,
                                this.module.i32.add(
                                    this.module.local.get(1, binaryen.i32),
                                    this.module.i32.const(1)
                                )
                            ),
                            this.module.br("0")
                        ])
                    )
                ),
                this.module.return(
                    this.module.local.get(2, binaryen.i32)
                )
            ])
        )
    }
}


