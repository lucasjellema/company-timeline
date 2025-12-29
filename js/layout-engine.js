import { parseDate } from './utils.js';

export function processTimelineData(data) {
    const events = data.map((d, i) => ({
        ...d,
        id: i,
        startDate: parseDate(d.start),
        endDate: parseDate(d.end),
    }));

    // Group by level0
    const groups = d3.group(events, d => d.level0);

    // Sort levels: "company" first, then alphabetical
    const sortedLevel0 = Array.from(groups.keys()).sort((a, b) => {
        if (a.toLowerCase() === 'company') return -1;
        if (b.toLowerCase() === 'company') return 1;
        return a.localeCompare(b);
    });

    const layout = [];
    let currentYOffset = 0;

    sortedLevel0.forEach(level0 => {
        const levelEvents = groups.get(level0);
        // Sort by start date, then duration (desc)
        levelEvents.sort((a, b) => a.startDate - b.startDate || (b.endDate - b.startDate) - (a.endDate - a.startDate));

        const rows = []; // array of arrays (events in each row)

        levelEvents.forEach(event => {
            let placed = false;
            for (let i = 0; i < rows.length; i++) {
                if (!overlapsWithRow(event, rows[i])) {
                    rows[i].push(event);
                    event.rowIndex = i;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                event.rowIndex = rows.length;
                rows.push([event]);
            }
        });

        layout.push({
            level0,
            events: levelEvents,
            rowCount: rows.length,
            yOffset: 0 // Will be calculated after all heights known
        });
    });

    return layout;
}

function overlapsWithRow(event, row) {
    return row.some(e => {
        // Events overlap if [start1, end1] intersects [start2, end2]
        return event.startDate < e.endDate && event.endDate > e.startDate;
    });
}
