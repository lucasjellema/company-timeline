import { CONFIG } from './config.js';

export function drawAxis(svg, xScale, width, totalHeight, zoomFactor) {
    const monthsDiff = d3.timeMonth.count(xScale.domain()[0], xScale.domain()[1]);

    // Determine granularity based on zoom factor
    let interval, formatType;

    if (zoomFactor >= CONFIG.ZOOM_GRANULARITY.WEEKLY_THRESHOLD) {
        // Weekly granularity at high zoom
        interval = d3.timeWeek.every(1);
        formatType = 'week';
    } else if (zoomFactor >= CONFIG.ZOOM_GRANULARITY.MONTHLY_THRESHOLD) {
        // Monthly granularity at medium zoom
        interval = d3.timeMonth.every(1);
        formatType = 'month';
    } else if (zoomFactor >= CONFIG.ZOOM_GRANULARITY.QUARTERLY_THRESHOLD) {
        // Quarterly granularity at low-medium zoom
        interval = d3.timeMonth.every(3);
        formatType = 'quarter';
    } else {
        // Yearly granularity at minimum zoom
        // Adapt based on available width per tick to avoid overlap
        const start = xScale.domain()[0];
        const end = xScale.domain()[1];
        const yearCount = d3.timeYear.count(start, end);
        const widthPerYear = yearCount > 0 ? width / yearCount : width;

        if (widthPerYear < 0.05) { // < 0.05px per year -> every 1000 years
            interval = d3.timeYear.every(1000);
        } else if (widthPerYear < 0.1) { // < 0.1px per year -> every 500 years
            interval = d3.timeYear.every(500);
        } else if (widthPerYear < 0.25) { // < 0.25px per year -> every 200 years
            interval = d3.timeYear.every(200);
        } else if (widthPerYear < 0.5) { // < 0.5px per year -> every 100 years
            interval = d3.timeYear.every(100);
        } else if (widthPerYear < 1) { // < 1px per year -> every 50 years
            interval = d3.timeYear.every(50);
        } else if (widthPerYear < 2.5) { // < 2.5px per year -> every 20 years
            interval = d3.timeYear.every(20);
        } else if (widthPerYear < 5) { // < 5px per year -> every 10 years
            interval = d3.timeYear.every(10);
        } else if (widthPerYear < 12) {
            interval = d3.timeYear.every(5);
        } else if (widthPerYear < 25) {
            interval = d3.timeYear.every(2);
        } else {
            interval = d3.timeYear.every(1);
        }
        formatType = 'year';
    }

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
