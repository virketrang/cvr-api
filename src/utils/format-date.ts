export default function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat("da-DK", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(date));
}
