export const parseDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') {
        return null; // No date provided (for events without end date)
    }

    const parts = dateStr.trim().split('-');

    if (parts.length === 2) {
        // Format: YYYY-MM (month precision)
        const [year, month] = parts.map(Number);
        return new Date(year, month - 1, 1);
    } else if (parts.length === 3) {
        // Could be YYYY-MM-DD or DD-MM-YYYY
        const firstPart = parseInt(parts[0]);

        if (firstPart > 31) {
            // Format: YYYY-MM-DD
            const [year, month, day] = parts.map(Number);
            return new Date(year, month - 1, day);
        } else {
            // Format: DD-MM-YYYY
            const [day, month, year] = parts.map(Number);
            return new Date(year, month - 1, day);
        }
    }

    // Check for single year (e.g. "200", "1999", "2025")
    if (parts.length === 1) {
        // Is it a number?
        if (/^\d{1,4}$/.test(parts[0])) {
            const year = parseInt(parts[0], 10);
            // new Date(year, ...) handles 0-99 as 1900-1999 usually? 
            // Actually new Date(year, month) constructor:
            // "if year is between 0 and 99, it effectively maps to 1900-1999" - legacy behavior.
            // To support year 200, we must use setFullYear.
            const d = new Date(0); // clear date
            d.setFullYear(year, 0, 1);
            d.setHours(0, 0, 0, 0);
            return d;
        }
    }

    // Fallback: try to parse as-is
    return new Date(dateStr);
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const parseDateComponents = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('-');
    if (parts.length === 1) return { year: parts[0], precision: 'year' };
    if (parts.length === 2) return { year: parts[0], month: parseInt(parts[1]), precision: 'month' };
    if (parts.length === 3) return { year: parts[0], month: parseInt(parts[1]), day: parseInt(parts[2]), precision: 'day' };
    return null;
};

const formatSingleDate = (d) => {
    if (d.precision === 'year') return d.year;
    const monthName = MONTH_NAMES[d.month - 1];
    if (d.precision === 'month') return `${monthName} ${d.year}`;
    return `${getOrdinal(d.day)} ${monthName} ${d.year}`;
};

export const formatTooltipDate = (startStr, endStr) => {
    if (!startStr) return '';
    const start = parseDateComponents(startStr);
    const end = parseDateComponents(endStr);

    if (!end) {
        return formatSingleDate(start) + ' - Ongoing';
    }

    // Check if start and end are exactly the same
    if (startStr === endStr) {
        return formatSingleDate(start);
    }

    if (start.year === end.year) {
        const monthNameStart = (start.month) ? MONTH_NAMES[start.month - 1] : '';
        const monthNameEnd = (end.month) ? MONTH_NAMES[end.month - 1] : '';

        if (start.month === end.month) {
            // Same month
            if (start.precision === 'day' && end.precision === 'day') {
                // 10th - 20th May 2023
                return `${getOrdinal(start.day)} - ${getOrdinal(end.day)} ${monthNameEnd} ${end.year}`;
            }
        } else {
            // Different month, same year
            if (start.precision === 'day' && end.precision === 'day') {
                // 10th May - 20th June 2023
                return `${getOrdinal(start.day)} ${monthNameStart} - ${getOrdinal(end.day)} ${monthNameEnd} ${end.year}`;
            }
            if (start.precision === 'month' && end.precision === 'month') {
                // May - June 2023
                return `${monthNameStart} - ${monthNameEnd} ${end.year}`;
            }
            // If one is day and other is month? e.g. May - 10th June 2023
            if (start.precision === 'month' && end.precision === 'day') {
                return `${monthNameStart} - ${getOrdinal(end.day)} ${monthNameEnd} ${end.year}`;
            }
            if (start.precision === 'day' && end.precision === 'month') {
                return `${getOrdinal(start.day)} ${monthNameStart} - ${monthNameEnd} ${end.year}`;
            }
        }
    }

    return `${formatSingleDate(start)} - ${formatSingleDate(end)}`;
};

export const formatDate = (date) => {
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
};

const NICE_COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#8B5CF6", // Violet
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#6366F1", // Indigo
    "#EC4899", // Pink (existing default)
    "#14B8A6", // Teal
    "#F97316", // Orange
    "#84CC16", // Lime
    "#06B6D4", // Cyan
    "#D946EF"  // Fuchsia
];

const AUTO_ICONS = ["circle", "star", "square", "triangle", "diamond", "hexagon"];

export const generateTypeMappings = (data, existingColors = {}, existingIcons = {}) => {
    const newColors = { ...existingColors };
    const newIcons = { ...existingIcons };
    const types = new Set();

    // 1. Find all unique types
    data.forEach(d => {
        if (d.type) types.add(d.type.toLowerCase());
    });

    let colorIdx = 0;
    let iconIdx = 0;

    // Helper to get hash code for consistent assignment
    const getHashCode = (s) => {
        let h = 0;
        for (let i = 0; i < s.length; i++)
            h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        return h;
    }

    types.forEach(type => {
        // Assign Color if missing
        if (!newColors[type]) {
            // Deterministic assignment based on type name string
            const hash = Math.abs(getHashCode(type));
            // Use hash to pick a color, but also ensure we don't just pick 'pink' if it's already used?
            // Simple mapping is fine.
            newColors[type] = NICE_COLORS[hash % NICE_COLORS.length];
        }

        // Assign Icon if missing
        if (!newIcons[type]) {
            const hash = Math.abs(getHashCode(type));
            newIcons[type] = AUTO_ICONS[hash % AUTO_ICONS.length];
        }
    });

    return { colors: newColors, icons: newIcons };
};

export const getEventColor = (type, colors) => {
    return colors[type.toLowerCase()] || colors.default;
};

export const createTooltip = () => {
    const tooltip = document.getElementById('tooltip');
    let hideTimeout = null;

    // Keep tooltip open when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    });

    // Hide tooltip when leaving it
    tooltip.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
            tooltip.classList.add('hidden');
            tooltip.style.pointerEvents = 'none';
        }, 300); // 300ms grace period
    });

    return {
        isLocked: () => {
            // Locked if interactive mode is ON (pointerEvents auto) AND (hovering tooltip OR hideTimeout is valid)
            // Actually, if hideTimeout is active, it means user left the target but hasn't entered tooltip yet (or just left it).
            // We want to lock 'active' if the tooltip is intended to be used.
            // Simplified: if pointerEvents is auto, we treat it as potentially locked.
            return tooltip.style.pointerEvents === 'auto' && !tooltip.classList.contains('hidden');
        },
        show: (e, content, interactive = false) => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }

            tooltip.innerHTML = content;
            tooltip.classList.remove('hidden');

            // If interactive, verify it stays within viewport
            let left = e.pageX + 40;
            let top = e.pageY + 40;

            // Simple viewport check (assuming standard window)
            if (interactive) {
                const tooltipWidth = 460; // Map width (400) + padding (32) + border + safety
                if (left + tooltipWidth > window.innerWidth) {
                    left = e.pageX - tooltipWidth - 40;
                }
                tooltip.style.pointerEvents = 'auto';
            } else {
                tooltip.style.pointerEvents = 'none';
            }

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        },
        hide: () => {
            // Delay hiding to allow user to move mouse into tooltip
            hideTimeout = setTimeout(() => {
                tooltip.classList.add('hidden');
                tooltip.style.pointerEvents = 'none';
            }, 300);
        },
        forceHide: () => {
            if (hideTimeout) clearTimeout(hideTimeout);
            tooltip.classList.add('hidden');
            tooltip.style.pointerEvents = 'none';
        },
        move: (e) => {
            if (tooltip.style.pointerEvents === 'auto') return; // Don't move if interactive
            tooltip.style.left = `${e.pageX + 40}px`;
            tooltip.style.top = `${e.pageY + 40}px`;
        }
    };
};

export const ensureDataIds = (data) => {
    let modified = false;
    data.forEach((d, i) => {
        if (!d.id) {
            d.id = `evt-${Date.now()}-${i}`; // Simple sortable ID
            modified = true;
        }
    });
    return modified;
};

export const parseAndPrepareCSV = (csvContent) => {
    try {
        const data = d3.csvParse(csvContent);
        ensureDataIds(data);
        return data;
    } catch (error) {
        console.error("Error parsing CSV:", error);
        throw new Error("Failed to parse CSV content. Please ensure it is valid CSV format.");
    }
};
