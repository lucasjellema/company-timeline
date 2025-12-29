import { CONFIG } from './config.js';
import { getEventColor, createTooltip } from './utils.js';

export class TimelineRenderer {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.tooltip = createTooltip();
        this.sliderDate = null;
        this.zoomFactor = 1;
        this.onSliderMove = null;
        this.layoutData = null;
        this.xScale = null;
        this.width = 0;
        this.totalHeight = 0;
    }

    render(layoutData, preserveSlider = false) {
        this.layoutData = layoutData;
        this.container.selectAll("*").remove();

        const allEvents = layoutData.flatMap(d => d.events);
        const minDate = d3.min(allEvents, d => d.startDate);
        const maxDate = d3.max(allEvents, d => d.endDate);

        if (!this.sliderDate || !preserveSlider) {
            this.sliderDate = d3.timeMonth.offset(minDate, 2);
        }

        const containerWidth = this.container.node().getBoundingClientRect().width - 40;
        const baseWidth = Math.max(1000, containerWidth);
        this.width = baseWidth * this.zoomFactor;

        const range = [CONFIG.PADDING.LEFT, this.width - CONFIG.PADDING.RIGHT];

        this.xScale = d3.scaleTime()
            .domain([minDate, maxDate])
            .range(range);

        // Calculate total height
        this.totalHeight = CONFIG.PADDING.TOP;
        layoutData.forEach(level => {
            level.yStart = this.totalHeight;
            level.height = level.rowCount * (CONFIG.BAR_HEIGHT + CONFIG.BAR_SPACING) + CONFIG.LEVEL_SPACING;
            this.totalHeight += level.height;
        });
        this.totalHeight += CONFIG.PADDING.BOTTOM;

        const svg = this.container.append("svg")
            .attr("width", this.width)
            .attr("height", this.totalHeight)
            .attr("viewBox", `0 0 ${this.width} ${this.totalHeight}`);

        this.drawAxis(svg, this.xScale, this.width);
        this.drawLevelsAndEvents(svg, layoutData, this.xScale);
        this.drawSlider(svg);

        // Initial highlight
        this.updateActiveEvents();

        // Scroll to slider
        this.scrollToSlider();
    }

    scrollToSlider() {
        const sliderX = this.xScale(this.sliderDate);
        const container = this.container.node();
        const viewportWidth = container.clientWidth;
        container.scrollLeft = sliderX - viewportWidth / 2;
    }

    zoom(delta) {
        const prevZoom = this.zoomFactor;
        this.zoomFactor = Math.max(1, Math.min(20, this.zoomFactor + delta));
        if (prevZoom !== this.zoomFactor) {
            this.render(this.layoutData, true);
        }
    }

    drawAxis(svg, xScale, width) {
        const monthsDiff = d3.timeMonth.count(xScale.domain()[0], xScale.domain()[1]);
        let interval = d3.timeMonth.every(3);
        if (monthsDiff < 12) interval = d3.timeMonth.every(1);
        if (monthsDiff > 60) interval = d3.timeYear.every(1);

        const xAxis = d3.axisTop(xScale)
            .ticks(interval)
            .tickSize(-this.totalHeight + CONFIG.PADDING.TOP)
            .tickFormat(d => {
                const month = d.getMonth();
                if (month === 0) return d3.timeFormat("%Y")(d);
                if (monthsDiff < 24) return d3.timeFormat("%b %y")(d);
                if (month % 3 === 0) return d3.timeFormat("Q%q")(d);
                return "";
            });

        const axisG = svg.append("g")
            .attr("transform", `translate(0, ${CONFIG.PADDING.TOP - 20})`)
            .call(xAxis);

        axisG.selectAll(".tick line")
            .attr("class", "grid-line")
            .style("stroke-opacity", d => d.getMonth() === 0 ? 0.3 : 0.1);

        axisG.select(".domain").remove();
        axisG.selectAll("text")
            .attr("class", "axis-text")
            .style("font-weight", d => d.getMonth() === 0 ? "700" : "400");
    }

    drawLevelsAndEvents(svg, layoutData, xScale) {
        layoutData.forEach((level, lIndex) => {
            const levelG = svg.append("g").attr("transform", `translate(0, ${level.yStart})`);

            levelG.append("rect").attr("class", "level-bg").attr("width", this.width).attr("height", level.height - 15);
            levelG.append("line").attr("class", "level-separator").attr("x1", 0).attr("x2", this.width).attr("y1", level.height - 10).attr("y2", level.height - 10);
            levelG.append("text").attr("class", "level-label").attr("x", 20).attr("y", 25).text(level.level0);

            const eventGroups = levelG.selectAll(".event-g")
                .data(level.events).enter().append("g").attr("class", "event-g")
                .attr("transform", d => `translate(${xScale(d.startDate)}, ${45 + d.rowIndex * (CONFIG.BAR_HEIGHT + CONFIG.BAR_SPACING)})`);

            eventGroups.append("rect").attr("class", "event-bar")
                .attr("height", CONFIG.BAR_HEIGHT).attr("fill", d => getEventColor(d.type, CONFIG.TYPE_COLORS))
                .attr("width", d => Math.max(8, xScale(d.endDate) - xScale(d.startDate)))
                .on("mouseenter", (e, d) => this.tooltip.show(e, `<span class="tooltip-title">${d.title}</span><strong>Type:</strong> ${d.type}<br><strong>Period:</strong> ${d.start} to ${d.end}<br><br>${d.description}`))
                .on("mousemove", (e) => this.tooltip.move(e))
                .on("mouseleave", () => this.tooltip.hide());

            eventGroups.append("text").attr("class", "bar-label").attr("x", 4).attr("y", CONFIG.BAR_HEIGHT + 16).text(d => d.title);
        });
    }

    drawSlider(svg) {
        const sliderX = this.xScale(this.sliderDate);
        const sliderG = svg.append("g").attr("class", "slider-group");
        sliderG.append("line").attr("class", "time-slider-line").attr("x1", sliderX).attr("x2", sliderX).attr("y1", CONFIG.PADDING.TOP - 30).attr("y2", this.totalHeight);
        sliderG.append("rect").attr("class", "time-slider-hitbox").attr("x", sliderX - 10).attr("y", CONFIG.PADDING.TOP - 40).attr("width", 20).attr("height", 30)
            .call(d3.drag().on("drag", (event) => {
                const newDate = this.xScale.invert(event.x);
                if (newDate >= this.xScale.domain()[0] && newDate <= this.xScale.domain()[1]) {
                    this.sliderDate = newDate;
                    this.updateSliderUI(sliderG);
                    this.updateActiveEvents();
                }
            }));
        sliderG.append("circle").attr("class", "time-slider-handle").attr("cx", sliderX).attr("cy", CONFIG.PADDING.TOP - 25).attr("r", 6);
    }

    updateSliderUI(sliderG) {
        const x = this.xScale(this.sliderDate);
        sliderG.select(".time-slider-line").attr("x1", x).attr("x2", x);
        sliderG.select(".time-slider-handle").attr("cx", x);
        sliderG.select(".time-slider-hitbox").attr("x", x - 10);
    }

    updateActiveEvents() {
        const activeEvents = this.layoutData.flatMap(l => l.events).filter(e =>
            this.sliderDate >= e.startDate && this.sliderDate <= e.endDate
        );

        this.container.selectAll(".event-bar")
            .classed("active", d => activeEvents.includes(d));

        if (this.onSliderMove) {
            this.onSliderMove(this.sliderDate, activeEvents);
        }
    }
}
