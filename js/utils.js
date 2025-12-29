export const parseDate = (dateStr) => {
    // Expected format: YYYY-M or YYYY-MM
    const [year, month] = dateStr.split('-').map(Number);
    // JS Months are 0-indexed
    return new Date(year, month - 1, 1);
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
            tooltip.style.left = `${e.pageX + 15}px`;
            tooltip.style.top = `${e.pageY + 15}px`;
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
