/**
 * Parses a date string into a corresponding Date object.
 * Supports multiple formats:
 * - YYYY-MM (Month precision, defaults to 1st of month)
 * - YYYY-MM-DD
 * - DD-MM-YYYY
 * - YYYY (Single year)
 * 
 * @param {string} dateStr - The date string to parse.
 * @returns {Date|null} The parsed Date object, or null if input is empty/invalid.
 */
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

const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a Date to "Jan 1, 2023" style (no zero padding).
 */
export const formatDateFriendly = (date) => {
    if (!date) return '';
    const m = SHORT_MONTH_NAMES[date.getMonth()];
    const d = date.getDate(); // No padding
    const y = date.getFullYear(); // No padding (e.g. 590)
    return `${m} ${d}, ${y}`;
};

/**
 * Formats a Date to "January 2023" style (no zero padding for year).
 */
export const formatMonthYearFriendly = (date) => {
    if (!date) return '';
    const m = MONTH_NAMES[date.getMonth()];
    const y = date.getFullYear(); // No padding
    return `${m} ${y}`;
};

const parseDateComponents = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('-');
    if (parts.length === 1) return { year: parts[0], precision: 'year' };
    if (parts.length === 2) return { year: parts[0], month: parseInt(parts[1]), precision: 'month' };
    if (parts.length === 3) return { year: parts[0], month: parseInt(parts[1]), day: parseInt(parts[2]), precision: 'day' };
    return null;
};

/**
 * Formats a single date object into a human-readable string.
 * Supports different levels of precision (year, month, day).
 * @param {object} d - The date object to format.
 * @param {string} d.year - The year of the date.
 * @param {number} d.month - The month of the date (1-12).
 * @param {number} d.day - The day of the date (1-31).
 * @param {string} d.precision - The precision of the date (year, month, day).
 * @returns {string} The formatted date string.
 */
const formatSingleDate = (d) => {
    const year = parseInt(d.year, 10);
    if (d.precision === 'year') return String(year);
    const monthName = MONTH_NAMES[d.month - 1];
    if (d.precision === 'month') return `${monthName} ${year}`;
    return `${getOrdinal(d.day)} ${monthName} ${year}`;
};

/**
 * Generates a friendly date range string for tooltips.
 * Intelligently merges parts of the date that are same (e.g., same year, same month)
 * to produce a concise string like "May - June 2023".
 * 
 * @param {string} startStr - The start date string.
 * @param {string} endStr - The end date string.
 * @returns {string} The formatted date range string.
 */
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

/**
 * Formats a Date object into a simple "YYYY-M" string (1-based month).
 * 
 * @param {Date} date - The date to format.
 * @returns {string} The formatted string.
 */
export const formatDate = (date) => {
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
};

/**
 * Formats a date string into a compact representation (yyyy, mm-yyyy, or dd-mm-yyyy).
 * @param {string} dateStr - The date string to format.
 * @returns {string} The compact date string.
 */
export const formatCompactDate = (dateStr) => {
    const d = parseDateComponents(dateStr);
    if (!d) return '';
    const year = parseInt(d.year, 10);
    if (d.precision === 'year') return String(year);

    const m = d.month;
    if (d.precision === 'month') return `${m}-${year}`;

    const day = d.day;
    return `${day}-${m}-${year}`;
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

/**
 * Scans the provided data for unique event types and auto-generates 
 * color and icon mappings for any that are missing.
 * Uses a deterministic hash of the type name to assign consistent colors/icons.
 * 
 * @param {Array} data - The dataset to scan.
 * @param {Object} existingColors - Existing map of type -> color.
 * @param {Object} existingIcons - Existing map of type -> icon.
 * @returns {Object} An object containing { colors, icons } with new mappings added.
 */
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

/**
 * Helper to retrieve the color for a specific event type.
 * Returns the default color if the type is not found.
 * 
 * @param {string} type - The event type.
 * @param {Object} colors - The dictionary of type->color.
 * @returns {string} Hex color code.
 */
export const getEventColor = (type, colors) => {
    return colors[type.toLowerCase()] || colors.default;
};

/**
 * Creates a tooltip controller that manages the DOM element for the tooltip.
 * Handles:
 * - Showing/Hiding with grace periods
 * - Positioning relative to mouse
 * - Interactive mode (keeping tooltip open when user hovers over it)
 * 
 * @returns {Object} An object with methods: { show, hide, forceHide, move, isLocked }
 */
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

/**
 * Ensures every item in the data array has a unique 'id'.
 * If an ID is missing, generates a sorted unique ID based on timestamp and index.
 * 
 * @param {Array} data - The array of data objects.
 * @returns {boolean} True if any IDs were generated, False otherwise.
 */
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

/**
 * Parses a raw CSV string into a data array using D3, and ensures all items have IDs.
 * 
 * @param {string} csvContent - The raw CSV string content.
 * @returns {Array} Parsed data array.
 * @throws {Error} If parsing fails.
 */
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
