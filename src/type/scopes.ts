export class Scope {
    public parent?: Scope;
    public children: Array<Scope>;
    public elems: Map<string, Object>;

    constructor(parent?: Scope) {
        if (parent) {
            this.parent = parent;
        }
        this.children = new Array<Scope>();
        this.elems = new Map<string, Object>();
    }

    insert(name: string, obj: Object) {
        this.elems.set(name, obj);
    }
}

