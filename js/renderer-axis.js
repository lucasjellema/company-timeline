import { CONFIG } from './config.js';

export function drawAxis(svg, xScale, width, totalHeight, zoomFactor) {
    const start = xScale.domain()[0];
    const end = xScale.domain()[1];
    // We want ~10 labels per "screen width" (base width).
    // The total width is roughly baseWidth * zoomFactor.
    // So total labels on the entire axis should be ~10 * zoomFactor.
    const maxLabels = Math.ceil(10 * zoomFactor);
    const minLabels = Math.ceil(5 * zoomFactor);
    let interval, formatType;

    // Helper: Round up to nearest nice number [1, 2, 5, 10, 20, 50, 100, etc]
    const getNiceStep = (rawStep) => {
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const normalized = rawStep / magnitude;
        let niceNorm;
        if (normalized <= 1) niceNorm = 1;
        else if (normalized <= 2) niceNorm = 2;
        else if (normalized <= 5) niceNorm = 5;
        else niceNorm = 10;
        return niceNorm * magnitude;
    };

    const yearCount = d3.timeYear.count(start, end);

    if (yearCount >= minLabels) {
        // CASE: Years
        // We want at most maxLabels.
        // rawStep = yearCount / maxLabels.
        // Example: 100 years / 10 = 10.
        // Example: 6 years / 10 = 0.6 -> step 1.
        let rawStep = Math.max(1, yearCount / maxLabels);
        let step = getNiceStep(rawStep);
        interval = d3.timeYear.every(step);
        formatType = 'year';
    } else {
        // Less than 5 years. Try Quarters.
        const monthCount = d3.timeMonth.count(start, end);
        const quarterCount = monthCount / 3;

        if (quarterCount >= minLabels) {
            // CASE: Quarters
            let rawStep = Math.max(1, Math.ceil(quarterCount / maxLabels));
            // rawStep is in "units of 3 months".
            // e.g. rawStep 2 => every 2 quarters => every 6 months.
            interval = d3.timeMonth.every(rawStep * 3);
            formatType = 'quarter';
        } else {
            // Less than 5 quarters. Try Months.
            if (monthCount >= minLabels) {
                // CASE: Months
                let step = Math.max(1, Math.ceil(monthCount / maxLabels));
                interval = d3.timeMonth.every(step);
                formatType = 'month';
            } else {
                // CASE: Weeks (Default fallback)
                const weekCount = d3.timeWeek.count(start, end);
                let step = Math.max(1, Math.ceil(weekCount / maxLabels));
                interval = d3.timeWeek.every(step);
                formatType = 'week';
            }
        }
    }

    // We use .ticks() with our calculated interval

    const xAxis = d3.axisTop(xScale)
        .ticks(interval)
        .tickSize(-totalHeight + CONFIG.PADDING.TOP)
        .tickFormat(d => {
            const month = d.getMonth();

            if (formatType === 'week') {
                // Show week number for weekly view
                const weekNum = d3.timeWeek.count(d3.timeYear(d), d);
                if (month === 0 && weekNum <= 1) {
                    return d3.timeFormat("%Y")(d);
                }
                return d3.timeFormat("%b %d")(d);
            } else if (formatType === 'month') {
                // Show month abbreviation for monthly view
                if (month === 0) {
                    return d3.timeFormat("%Y")(d);
                }
                return d3.timeFormat("%b")(d);
            } else if (formatType === 'quarter') {
                // Show quarters for quarterly view
                if (month === 0) {
                    return d3.timeFormat("%Y")(d);
                }
                if (month % 3 === 0) {
                    return d3.timeFormat("Q%q")(d);
                }
                return "";
            } else {
                return d3.timeFormat("%Y")(d);
            }
        });

    const axisG = svg.append("g")
        .attr("transform", `translate(0, ${CONFIG.PADDING.TOP - 20})`)
        .call(xAxis);

    axisG.selectAll(".tick line")
        .attr("class", "grid-line")
        .style("stroke-opacity", d => {
            const month = d.getMonth();
            // Emphasize year boundaries and quarters
            if (month === 0) return 0.3;
            if (formatType === 'quarter' && month % 3 === 0) return 0.15;
            return 0.1;
        });

    axisG.select(".domain").remove();
    axisG.selectAll("text")
        .attr("class", "axis-text")
        .style("font-weight", d => d.getMonth() === 0 ? "700" : "400");
}
