import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'relativeTime',
    standalone: true
})
export class RelativeTimePipe implements PipeTransform {

    transform(value: string | Date | undefined | null): string {
        if (!value) return '';

        const date = this.parseToDate(value);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) {
            return `${seconds} s ago`;
        }

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes} m ago`;
        }

        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours} hrs ago`;
        }

        const days = Math.floor(hours / 24);
        if (days < 30) {
            return `${days} days ago`;
        }

        const months = Math.floor(days / 30);
        if (months < 12) {
            return `${months} months ago`;
        }

        const years = Math.floor(days / 365);
        return `${years} years ago`;
    }

    private parseToDate(value: string | Date): Date {
        if (value instanceof Date) return value;

        let s = String(value).trim();

        // If the string already contains a timezone (Z or ±HH[:]?MM), return as-is
        const tzRegex = /([zZ]|[+\-]\d{2}:?\d{2})$/;
        if (!tzRegex.test(s)) {
            // Append 'Z' to treat the timestamp as UTC when no timezone is present
            s = s + 'Z';
        }

        let d = new Date(s);
        if (!isNaN(d.getTime())) return d;

        // Fallback: some environments don't like more than 3 fractional digits.
        // Truncate fractional seconds to 3 digits (milliseconds) and retry.
        const fracFix = s.replace(/\.(\d{3})\d*(Z?)$/, '.$1$2');
        d = new Date(fracFix);
        if (!isNaN(d.getTime())) return d;

        // Final fallback: let Date try one more time without any fractional part
        const noFrac = s.replace(/\.\d+(Z?)$/, '$1');
        d = new Date(noFrac);
        return d;
    }

}
