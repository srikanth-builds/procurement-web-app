export function formatLabel(key: string): string {
    // Replace underscores with spaces and capitalize words
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
}
