// TODO: add stuff later
import binaryen from "binaryen";
import { Param, Stmt } from "../parsing/ast";
import { _Symbol } from "./symbol";

export class Function {
    public module: binaryen.Module;
    public ident: string;
    public params: Array<Param>;
    public returnType: string;
    public body: Array<Stmt>;
    public locals: Map<string, _Symbol>;


    constructor(module: binaryen.Module, ident: string, params: Array<Param>, returnType: string, body: Array<Stmt>) {
        this.module = module;
        this.ident = ident;
        this.params = params;
        this.returnType = returnType;
        this.body = body;
        this.locals = new Map<string, _Symbol>();
    }
}