import { CONFIG } from './config.js';
import { createTooltip } from './utils.js';
import { drawAxis } from './renderer-axis.js';
import { drawLevelsAndEvents } from './renderer-events.js';
import {
    drawSlider,
    updateActiveEvents,
    handleEventHover,
    highlightEvent,
    unhighlightEvent
} from './renderer-interaction.js';

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
        this.activeMapEventId = null;
        this.isMapPanelOpen = false;
    }

    render(layoutData, options = {}) {
        this.layoutData = layoutData;
        this.container.selectAll("*").remove();

        // Backward compatibility
        let preserveSlider = false;
        let customDomain = null;

        if (typeof options === 'boolean') {
            preserveSlider = options;
            this.typeColors = this.typeColors || CONFIG.TYPE_COLORS;
        } else {
            preserveSlider = options.preserveSlider || false;
            customDomain = options.domain || null;
            this.isDrilledDown = options.isDrilledDown || false;
            this.typeColors = options.typeColors || CONFIG.TYPE_COLORS;
            this.typeIcons = options.typeIcons || {};
            this.collapsedGroups = new Set(options.collapsedGroups || []);
            this.highlightedEventIds = options.highlightedEventIds || null;
            this.hiddenEventIds = options.hiddenEventIds || null;
        }

        const allEvents = layoutData.flatMap(d => d.events);
        let minDate, maxDate;

        if (customDomain && customDomain.length === 2) {
            [minDate, maxDate] = customDomain;
        } else {
            if (allEvents.length > 0) {
                minDate = d3.min(allEvents, d => d.startDate);
                maxDate = d3.max(allEvents, d => d.endDate);
            } else {
                const now = new Date();
                minDate = new Date(now.getFullYear(), 0, 1);
                maxDate = new Date(now.getFullYear(), 11, 31);
            }
        }

        if (!this.sliderDate || !preserveSlider) {
            this.sliderDate = d3.timeMonth.offset(minDate, 2);
        }

        if (this.sliderDate < minDate) this.sliderDate = minDate;
        if (this.sliderDate > maxDate) this.sliderDate = maxDate;

        const containerNode = this.container.node();
        const viewportWidth = containerNode.clientWidth;
        const baseWidth = Math.max(1000, viewportWidth - 20);

        this.width = Math.max(viewportWidth, baseWidth * this.zoomFactor);
        const range = [CONFIG.PADDING.LEFT, this.width - CONFIG.PADDING.RIGHT];

        this.xScale = d3.scaleTime().domain([minDate, maxDate]).range(range);

        this.totalHeight = CONFIG.PADDING.TOP;
        layoutData.forEach(level => {
            level.yStart = this.totalHeight; // level0 group starts vertically where previous groups have ended
            level.collapsed = this.collapsedGroups.has(level.level0);

            // Standard height based on rows (now potentially 0 or low if filtered)
            // TODO standardHeight will be too much for rows without icons or without bars
            // in order to calculate height we need to know how many rows have icons vs not
            let standardHeight = level.rowCount * (CONFIG.BAR_HEIGHT + CONFIG.BAR_SPACING) + CONFIG.LEVEL_SPACING;

            // If empty AND collapsed, enforce minimum height
            // If it has events (L0 visible events), standardHeight will be > 0 (1 row = 24+45+60 = 129px... wait 60 is padding)
            if (level.collapsed && level.events.length === 0 && level.pointEvents.length === 0) {
                level.height = CONFIG.LEVEL_COLLAPSED_HEIGHT;
            } else {
                // Even if it has 0 rows but we are NOT collapsed (shouldn't happen for valid L0 unless deleted data), 
                // we might want a minimum or just standard.
                // If rowCount is 0, height is just LEVEL_SPACING (60).
                // We want at least enough to see the title.

                if (level.rowCount === 0) {
                    standardHeight = CONFIG.LEVEL_COLLAPSED_HEIGHT;
                }
                // TODO in most cases, level.height will be too large
                level.height = Math.max(standardHeight, CONFIG.LEVEL_COLLAPSED_HEIGHT);
            }
            this.totalHeight += level.height;
        });
        this.totalHeight += CONFIG.PADDING.BOTTOM;

        const svg = this.container.append("svg")
            .attr("width", this.width)
            .attr("height", this.totalHeight)
            .style("width", `${this.width}px`)
            .style("height", `${this.totalHeight}px`)
            .attr("viewBox", `0 0 ${this.width} ${this.totalHeight}`);

        drawAxis(svg, this.xScale, this.width, this.totalHeight, this.zoomFactor);
        drawLevelsAndEvents(this, svg, layoutData, this.xScale);
        drawSlider(this, svg);

        this.updateActiveEvents();

        requestAnimationFrame(() => this.keepSliderInView(true));
    }

    keepSliderInView(alwaysCenter = false) {
        if (!this.xScale) return;

        const container = this.container.node();
        if (!container) return;

        const sliderX = this.xScale(this.sliderDate);
        const viewportWidth = container.clientWidth;
        const currentScroll = container.scrollLeft;
        const sliderPosInViewport = sliderX - currentScroll;

        const leftLimit = viewportWidth * 0.2;
        const rightLimit = viewportWidth * 0.8;

        if (alwaysCenter) {
            container.scrollLeft = sliderX - viewportWidth / 2;
        } else {
            if (sliderPosInViewport < leftLimit) {
                container.scrollLeft = sliderX - leftLimit;
            } else if (sliderPosInViewport > rightLimit) {
                container.scrollLeft = sliderX - rightLimit;
            }
        }
    }

    zoom(delta) {
        const prevZoom = this.zoomFactor;
        let effectiveDelta = delta;
        if (this.zoomFactor <= 1 && Math.abs(delta) >= 0.1) {
            effectiveDelta = delta * 0.2;
        }

        this.zoomFactor = Math.max(0.01, Math.min(20, this.zoomFactor + effectiveDelta));

        if (prevZoom !== this.zoomFactor) {
            this.render(this.layoutData, true);
        }
    }

    // Proxy methods for interaction module
    handleEventHover(e, d, options = {}) {
        handleEventHover(this, e, d, options);
    }

    updateActiveEvents() {
        updateActiveEvents(this);
    }

    highlightEvent(id) {
        highlightEvent(this, id);
    }

    unhighlightEvent(id) {
        unhighlightEvent(this, id);
    }
}
