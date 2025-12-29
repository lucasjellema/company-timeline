import { CONFIG, SAMPLE_CSV } from './config.js';
import { processTimelineData } from './layout-engine.js';
import { TimelineRenderer } from './renderer.js';

document.addEventListener('DOMContentLoaded', () => {
    const renderer = new TimelineRenderer('#timeline-viz');

    // UI Elements
    const dateLabel = document.getElementById('current-slider-date');
    const eventsList = document.getElementById('active-events-list');

    // Handle Slider Move
    renderer.onSliderMove = (date, activeEvents) => {
        dateLabel.textContent = d3.timeFormat("%B %Y")(date);

        if (activeEvents.length === 0) {
            eventsList.innerHTML = '<div class="empty-state">No events active at this time.</div>';
            return;
        }

        eventsList.innerHTML = activeEvents.map(e => {
            const color = CONFIG.TYPE_COLORS[e.type.toLowerCase()] || CONFIG.COLORS.default;
            return `
                <div class="event-item" style="border-left-color: ${color}">
                    <span class="event-item-title">${e.title}</span>
                    <div class="event-item-meta">
                        <strong>${e.level0}</strong> &middot; ${e.type}<br>
                        ${e.start} to ${e.end}
                    </div>
                </div>
            `;
        }).join('');
    };

    // Zoom Controls
    document.getElementById('zoom-in').addEventListener('click', () => renderer.zoom(0.5));
    document.getElementById('zoom-out').addEventListener('click', () => renderer.zoom(-0.5));

    // Load default data
    loadCSV(SAMPLE_CSV);

    // Handle File Upload
    const uploadInput = document.getElementById('csv-upload');
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                loadCSV(event.target.result);
            };
            reader.readAsText(file);
        }
    });

    // Handle Sample Download
    document.getElementById('download-sample').addEventListener('click', () => {
        const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'company_timeline_sample.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    });

    function loadCSV(csvText) {
        try {
            const data = d3.csvParse(csvText);
            const layout = processTimelineData(data);
            renderer.render(layout);
        } catch (error) {
            console.error("Error parsing CSV:", error);
            alert("Failed to parse CSV. Please check the format.");
        }
    }

    // Handle Resize
    window.addEventListener('resize', () => {
        if (renderer.layoutData) {
            renderer.render(renderer.layoutData, true);
        }
    });
});
