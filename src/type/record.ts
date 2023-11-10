import binaryen from "binaryen";
import { RuntimeError } from "../error";
import { BaseType, typeKind, Type } from "./type";


export class RecordType extends BaseType {
    public readonly kind = typeKind.RECORD;
    public fields: Map<string, Type>;

    constructor(fields: Map<string, Type>) {
        super();
        this.fields = fields;
    }

    public toString(): string {
        let str = "TYPE";
        for (let [key, value] of this.fields) {
            str += key + ": " + value.toString() + " ";
        }
        str += "ENDTYPE";
        return str;
    }

    public size(): number {
        let total: number = 0;
        for (let [key, value] of this.fields) {
            total += value.size();
        }
        return total;
    }

    public getField(name: string): Type {
        if (!this.fields.has(name)) {
            throw new RuntimeError("No member named " + name + "in " + this.toString());
        }
        return this.fields.get(name)!;
    }

    // static caculation (I think it will work fine)
    // returns the offset relative to the start of the record
    public offset(name: string): number {
        if (!this.fields.has(name)) {
            throw new RuntimeError("No member named " + name + "in " + this.toString());
        }
        // find the offset of the value by going over every field before it
        let offset: number = 0;
        for (let [key, value] of this.fields) {
            if (key === name) {
                break;
            }
            offset += value.size();
        }
        return offset;
    }

    public wasmType(): number {
        return binaryen.i32;
    }
}
