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

    // Fallback: try to parse as-is
    return new Date(dateStr);
};

export const formatDate = (date) => {
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
};

export const getEventColor = (type, colors) => {
    return colors[type.toLowerCase()] || colors.default;
};

export const createTooltip = () => {
    const tooltip = document.getElementById('tooltip');

    return {
        show: (e, content) => {
            tooltip.innerHTML = content;
            tooltip.classList.remove('hidden');
            tooltip.style.left = `${e.pageX + 20}px`;
            tooltip.style.top = `${e.pageY + 20}px`;
            tooltip.style.pointerEvents = 'none'; // Prevent tooltip from capturing mouse events
        },
        hide: () => {
            tooltip.classList.add('hidden');
        },
        move: (e) => {
            tooltip.style.left = `${e.pageX + 15}px`;
            tooltip.style.top = `${e.pageY + 15}px`;
        }
    };
};
