import binaryen from "binaryen";
import { LocalTable } from "./local";
import { BasicType, basicKind } from "../type/type";
import { Function } from "./function";
import { Generator } from "./generator";


// TODO: use a better way to store builtin functions
export class LengthFunction extends Function {
    // The initialization here is for the type checker to check if arg size and param size match
    // and the corresponding type matches
    constructor(module: binaryen.Module, enclosing: Generator) {
        const params = new LocalTable();
        params.set("str", new BasicType(basicKind.STRING), binaryen.i32, 0);
        const returnType = new BasicType(basicKind.INTEGER);
        super(module, enclosing, "LENGTH", params, returnType, binaryen.i32, true);
    }

    public generate(): void {
        // the whole function is static
        // it depends on none of the class properties
        // the properties in the class just act as an interface when this function is called
        // in c, this function looks like this
        /**
         * int my_strlen_utf8_c(char *s) {
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
                        this.module.i32.ne(
                            this.module.i32.load8_u(0, 1, this.module.local.get(1, binaryen.i32), "0"),
                            this.module.i32.const(0)
                        ),
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


