function formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

module.exports = { formatDate };
