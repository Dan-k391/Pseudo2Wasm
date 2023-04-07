export class Return extends Error {
    public value: unknown;

    constructor(value: unknown) {
        super();
        this.value = value;
    }
}