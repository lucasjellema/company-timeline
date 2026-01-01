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
            let left = e.pageX + 20;
            let top = e.pageY + 20;

            // Simple viewport check (assuming standard window)
            if (interactive) {
                const tooltipWidth = 400; // Approx based on map
                if (left + tooltipWidth > window.innerWidth) {
                    left = e.pageX - tooltipWidth - 20;
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
            tooltip.style.left = `${e.pageX + 15}px`;
            tooltip.style.top = `${e.pageY + 15}px`;
        }
    };
};
