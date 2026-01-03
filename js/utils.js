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

export const formatDate = (date) => {
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
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
