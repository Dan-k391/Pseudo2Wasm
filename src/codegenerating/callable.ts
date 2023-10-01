import binaryen from "binaryen";
import { LocalTable } from "./local";
import { Generator } from "./generator";

// FIXME: keep this, let function and procedure inherit this in the future
// export abstract class Callable {
//     // use protected
//     constructor(protected module: binaryen.Module,
//         protected ident: string,
//         // public params
//         public params: LocalTable) { }
    
//     public abstract generate(): void;
// }
