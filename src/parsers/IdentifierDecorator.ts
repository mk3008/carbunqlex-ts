export class IdentifierDecorator {
    start: string;
    end: string;

    constructor(identifierEscape?: { start?: string; end?: string }) {
        this.start = identifierEscape?.start ?? '"';
        this.end = identifierEscape?.end ?? '"';
    }

    decorate(text: string): string {
        // override
        text = this.start + text + this.end;
        return text;
    }
}
