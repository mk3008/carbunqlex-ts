/**
 * This decorator formats parameter tokens according to DBMS-specific rules.
 * It supports prefix/suffix, and parameter style (named, indexed, anonymous).
 */
export class ParameterDecorator {
    prefix: string;
    suffix: string;
    style: 'named' | 'indexed' | 'anonymous';

    constructor(options?: { prefix?: string; suffix?: string; style?: 'named' | 'indexed' | 'anonymous' }) {
        this.prefix = options?.prefix ?? ':';
        this.suffix = options?.suffix ?? '';
        this.style = options?.style ?? 'named';
    }

    /**
     * Decorate a parameter token with DBMS-specific format.
     * @param token The parameter token
     * @param index The parameter index (for indexed/anonymous)
     */
    decorate(text: string, index: number): string {
        let paramText = '';
        if (this.style === 'anonymous') {
            // e.g. ?
            paramText = this.prefix;
        } else if (this.style === 'indexed') {
            // e.g. $1, ?1, :1
            paramText = this.prefix + index;
        } else if (this.style === 'named') {
            // e.g. :name, @name, ${name}
            paramText = this.prefix + text + this.suffix;
        }

        // override 
        text = paramText;
        return text;
    }
}
