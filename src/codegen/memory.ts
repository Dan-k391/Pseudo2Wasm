import binaryen from "binaryen";

type Type = binaryen.Type;

// export class Page {
//     private maxSize: number;
//     private offset: number;
//     private values: Map<string, value>;

//     constructor() {
//         this.maxSize = 65536;
//         this.offset = 0;
//         this.values = new Map<string, value>();
//     }

//     public static sizeOfType(type: Type): number {
//         switch (type) {
//             case binaryen.i32:
//                 return 4;
//             case binaryen.i64:
//                 return 8;
//             case binaryen.f32:
//                 return 4;
//             case binaryen.f64:
//                 return 8;
//             default:
//                 throw new Error("Unknown type");
//         }
//     }

//     public add(ident: string, type: binaryen.Type): number {
//         if (this.offset + Page.sizeOfType(type) <= this.maxSize) {
//             const pointer = this.offset;
//             this.offset += Page.sizeOfType(type);
//             this.values.set(ident, new value(type, pointer));
//             return pointer;
//         }
//         return -1;
//     }
// }
