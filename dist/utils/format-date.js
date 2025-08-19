export default function formatDate(date) {
    return new Intl.DateTimeFormat("da-DK", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(date));
}
