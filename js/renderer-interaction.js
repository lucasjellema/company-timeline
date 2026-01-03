import { CONFIG } from './config.js';

export function drawSlider(renderer, svg) {
    const sliderX = renderer.xScale(renderer.sliderDate);
    const sliderG = svg.append("g").attr("class", "slider-group");
    sliderG.append("line").attr("class", "time-slider-line").attr("x1", sliderX).attr("x2", sliderX).attr("y1", CONFIG.PADDING.TOP - 30).attr("y2", renderer.totalHeight);
    sliderG.append("rect").attr("class", "time-slider-hitbox").attr("x", sliderX - 10).attr("y", CONFIG.PADDING.TOP - 40).attr("width", 20).attr("height", 30);
    sliderG.append("circle").attr("class", "time-slider-handle").attr("cx", sliderX).attr("cy", CONFIG.PADDING.TOP - 25).attr("r", 6).call(d3.drag().on("drag", (event) => {
        const newDate = renderer.xScale.invert(event.x);
        if (newDate >= renderer.xScale.domain()[0] && newDate <= renderer.xScale.domain()[1]) {
            renderer.sliderDate = newDate;
            updateSliderUI(renderer, sliderG);
            updateActiveEvents(renderer);
            renderer.keepSliderInView(false);
        }
    }));
}

export function updateSliderUI(renderer, sliderG) {
    const x = renderer.xScale(renderer.sliderDate);
    sliderG.select(".time-slider-line").attr("x1", x).attr("x2", x);
    sliderG.select(".time-slider-handle").attr("cx", x);
    sliderG.select(".time-slider-hitbox").attr("x", x - 10);
}

export function updateActiveEvents(renderer) {
    // Include both standard duration events and point events (like milestones)
    const allLayoutEvents = renderer.layoutData.flatMap(l => [...l.events, ...l.pointEvents]);

    const activeEvents = allLayoutEvents.filter(e =>
        renderer.sliderDate >= e.startDate && renderer.sliderDate <= e.endDate
    );

    renderer.container.selectAll(".event-bar")
        .classed("active", d => activeEvents.includes(d));

    if (renderer.onSliderMove) {
        renderer.onSliderMove(renderer.sliderDate, activeEvents);
    }
}

export function handleEventHover(renderer, e, d) { // Renamed slightly to accept renderer, but logic inside uses renderer properties
    // Actually, bind this methods to renderer in main class usually easier, but extracting logic:
    if (renderer.onEventHover) {
        renderer.onEventHover(e, d);
    }

    // Standard tooltip behavior
    // If external handler returns true, skip default
    if (renderer.onEventHover && renderer.onEventHover(e, d) === true) {
        return;
    }

    const lat = parseFloat(d.lattitude || d.latitude);
    const lng = parseFloat(d.longitude || d.longtitude);
    const hasMap = !isNaN(lat) && !isNaN(lng);

    // Conditional logic: Show map in tooltip ONLY if panel is closed
    if (hasMap && !renderer.isMapPanelOpen) {
        renderer.activeMapEventId = d.id;
        const mapId = `map-${d.id}`;
        const content = `
            <span class="tooltip-title">${d.title}</span>
            <div style="margin-bottom:8px; font-size: 0.9em"><strong>Type:</strong> ${d.type} &middot; <strong>Period:</strong> ${d.start} to ${d.end || 'Ongoing'}</div>
            <div style="margin-bottom:10px">${d.description}</div>
            <div id="${mapId}" style="width: 400px; height: 300px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: #333;"></div>
            `;

        // Show interactive tooltip
        renderer.tooltip.show(e, content, true);

        // Init map
        setTimeout(() => {
            const mapEl = document.getElementById(mapId);
            if (mapEl && !mapEl._leaflet_id) { // Check if exists and not already init
                const map = L.map(mapId, {
                    zoomControl: true,
                    dragging: true,
                    scrollWheelZoom: true
                }).setView([lat, lng], 9);

                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>'
                }).addTo(map);

                L.marker([lat, lng]).addTo(map);

                // Stop propagation to prevent bubbling issues
                mapEl.addEventListener('mousedown', (evt) => evt.stopPropagation());
            }
        }, 50);
    } else {
        renderer.activeMapEventId = null;

        // If local map is suppressed because panel is open, show hint?
        const mapHint = (hasMap && renderer.isMapPanelOpen) ? `<br><em style='color: #ccc; font-size: 0.8em'>Shown on map panel</em>` : "";

        // Icon for Tooltip
        const iconName = renderer.typeIcons && renderer.typeIcons[d.type ? d.type.toLowerCase() : ''];
        const iconHtml = (iconName && CONFIG.ICONS[iconName]) ?
            `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: sub; margin-right: 6px; fill: currentColor;"><path d="${CONFIG.ICONS[iconName]}"></path></svg>` :
            '';

        const content = `<span class="tooltip-title">${iconHtml}${d.title}</span>` +
            `<strong>Type:</strong> ${d.type}<br>` +
            `<strong>Period:</strong> ${d.start} to ${d.end || 'Ongoing'}<br><br>` +
            `${d.description}${mapHint}`;

        renderer.tooltip.show(e, content, false);
    }
}

export function highlightEvent(renderer, id) {
    // Highlight bars
    renderer.container.selectAll(`.event-bar[data-id="${id}"]`)
        .classed("highlighted", true)
        .style("stroke", "#fff")
        .style("stroke-width", "3px")
        .style("filter", "brightness(1.5) drop-shadow(0 0 10px var(--primary))");

    // Highlight triangles
    renderer.container.selectAll(`.event-triangle[data-id="${id}"]`)
        .classed("highlighted", true)
        .style("stroke-width", "3px")
        .style("filter", "brightness(1.5) drop-shadow(0 0 10px var(--primary))");
}

export function unhighlightEvent(renderer, id) {
    // Reset bars
    renderer.container.selectAll(`.event-bar[data-id="${id}"]`)
        .classed("highlighted", false)
        .style("stroke", null)
        .style("stroke-width", null)
        .style("filter", null);

    // Reset triangles
    renderer.container.selectAll(`.event-triangle[data-id="${id}"]`)
        .classed("highlighted", false)
        .style("stroke-width", "1.5px")
        .style("filter", null);
}
