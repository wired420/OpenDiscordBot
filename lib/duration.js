// Ban duration choices (minutes). 0 means permanent.
const BAN_DURATIONS = [
    { name: '1 hour', value: 60 },
    { name: '6 hours', value: 360 },
    { name: '12 hours', value: 720 },
    { name: '1 day', value: 1440 },
    { name: '3 days', value: 4320 },
    { name: '7 days', value: 10080 },
    { name: '30 days', value: 43200 },
    { name: 'Permanent', value: 0 },
];

function formatMinutes(minutes) {
    if (!minutes) return 'permanently';
    const known = BAN_DURATIONS.find(d => d.value === minutes);
    if (known) return known.name;
    if (minutes % 1440 === 0) return `${minutes / 1440} days`;
    if (minutes % 60 === 0) return `${minutes / 60} hours`;
    return `${minutes} minutes`;
}

module.exports = { BAN_DURATIONS, formatMinutes };
