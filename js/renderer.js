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
        this.activeMapEventId = null;
        this.isMapPanelOpen = false;
    }

    render(layoutData, options = {}) {
        this.layoutData = layoutData;
        this.container.selectAll("*").remove();

        // Backward compatibility: if options is boolean, treat as preserveSlider
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
        }

        const allEvents = layoutData.flatMap(d => d.events);

        let minDate, maxDate;

        if (customDomain && customDomain.length === 2) {
            [minDate, maxDate] = customDomain;
        } else {
            // Auto-calculate or Default
            if (allEvents.length > 0) {
                minDate = d3.min(allEvents, d => d.startDate);
                maxDate = d3.max(allEvents, d => d.endDate);
            } else {
                // Default fallback if no data and no domain: Current Year
                const now = new Date();
                minDate = new Date(now.getFullYear(), 0, 1);
                maxDate = new Date(now.getFullYear(), 11, 31);
            }
        }

        if (!this.sliderDate || !preserveSlider) {
            // If we have a domain, position slider somewhat intelligently (e.g. 10% in, or start date)
            // But usually 'offset 2 months' from minDate is the existing logic.
            this.sliderDate = d3.timeMonth.offset(minDate, 2);
        }

        // Ensure slider is within bounds (Always clamp, even if preserving, because the data domain might have changed/shrunk)
        if (this.sliderDate < minDate) this.sliderDate = minDate;
        if (this.sliderDate > maxDate) this.sliderDate = maxDate;

        const containerNode = this.container.node();
        const viewportWidth = containerNode.clientWidth;
        const baseWidth = Math.max(1000, viewportWidth - 20);

        // Limit width so it doesn't shrink smaller than viewport (for zoomed out view)
        this.width = Math.max(viewportWidth, baseWidth * this.zoomFactor);

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
            .style("width", `${this.width}px`)
            .style("height", `${this.totalHeight}px`)
            .attr("viewBox", `0 0 ${this.width} ${this.totalHeight}`);

        this.drawAxis(svg, this.xScale, this.width);
        this.drawLevelsAndEvents(svg, layoutData, this.xScale);
        this.drawSlider(svg);

        // Initial highlight
        this.updateActiveEvents();

        // Keep slider in view (center it initially). Use RAF to ensure DOM is ready.
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

        // If we are at low zoom levels, an additive delta of 0.5 is too aggressive and prevents going lower than 0.5 (as 0.5 - 0.5 = 0).
        // Let's switch to multiplicative zoom or adaptive delta.
        // Simple adaptive:
        let effectiveDelta = delta;
        if (this.zoomFactor <= 1 && Math.abs(delta) >= 0.1) {
            effectiveDelta = delta * 0.2;
        }

        // Allow zooming out further (down to 0.01)
        this.zoomFactor = Math.max(0.01, Math.min(20, this.zoomFactor + effectiveDelta));

        if (prevZoom !== this.zoomFactor) {
            this.render(this.layoutData, true);
        }
    }

    drawAxis(svg, xScale, width) {
        const monthsDiff = d3.timeMonth.count(xScale.domain()[0], xScale.domain()[1]);

        // Determine granularity based on zoom factor
        let interval, formatType;

        if (this.zoomFactor >= CONFIG.ZOOM_GRANULARITY.WEEKLY_THRESHOLD) {
            // Weekly granularity at high zoom
            interval = d3.timeWeek.every(1);
            formatType = 'week';
        } else if (this.zoomFactor >= CONFIG.ZOOM_GRANULARITY.MONTHLY_THRESHOLD) {
            // Monthly granularity at medium zoom
            interval = d3.timeMonth.every(1);
            formatType = 'month';
        } else if (this.zoomFactor >= CONFIG.ZOOM_GRANULARITY.QUARTERLY_THRESHOLD) {
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

            // "2025" is approx 30-40px wide. We want some padding.
            // Let's aim for min 50-60px per label.
            // "2025" is approx 30-40px wide. We want some padding.
            // Let's aim for min 50px per label.
            // widthPerYear = pixels per 1 year. 
            // yearsPerTick = 50 / widthPerYear

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
                interval = d3.timeYear.every(5); // Adjusted to 5 from 10 to be smoother? No, 12px*5=60px.
            } else if (widthPerYear < 25) {
                interval = d3.timeYear.every(2); // 25px*2=50px
            } else {
                interval = d3.timeYear.every(1);
            }
            formatType = 'year';
        }

        const xAxis = d3.axisTop(xScale)
            .ticks(interval)
            .tickSize(-this.totalHeight + CONFIG.PADDING.TOP)
            .tickFormat(d => {
                const month = d.getMonth();
                const day = d.getDate();

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
                    // Show only years for yearly view
                    // If very zoomed out, maybe only show every 5 years or based on tick count?
                    // D3 usually handles tick density well if we just provide format
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

    drawLevelsAndEvents(svg, layoutData, xScale) {
        layoutData.forEach((level, lIndex) => {
            const levelG = svg.append("g").attr("transform", `translate(0, ${level.yStart})`);

            levelG.append("rect").attr("class", "level-bg").attr("width", this.width).attr("height", level.height - 15);
            levelG.append("line").attr("class", "level-separator").attr("x1", 0).attr("x2", this.width).attr("y1", level.height - 10).attr("y2", level.height - 10);
            // Level Label Group with Interaction
            const labelG = levelG.append("g")
                .attr("class", "level-title-group")
                .style("cursor", "pointer")
                .on("dblclick", (e) => {
                    e.stopPropagation();
                    if (this.onCategoryDblClick) {
                        this.onCategoryDblClick(level.level0);
                    }
                });

            // Back Button (only if drilled down and callback exists)
            if (this.isDrilledDown) {
                const backBtn = labelG.append("g")
                    .attr("class", "back-button-icon")
                    .attr("transform", "translate(0, 15)") // Positioned relative to text baseline
                    .on("click", (e) => {
                        e.stopPropagation();
                        if (this.onBackButtonClick) this.onBackButtonClick();
                    });

                // Circle background
                backBtn.append("circle")
                    .attr("r", 10)
                    .attr("cx", 10)
                    .attr("cy", 5)
                    .attr("fill", "rgba(255,255,255,0.1)")
                    .attr("stroke", "#666")
                    .attr("stroke-width", 1);

                // Arrow Path
                backBtn.append("path")
                    .attr("d", "M 12 5 L 8 9 L 12 13") // Simple Left Arrow
                    .attr("stroke", "#fff")
                    .attr("fill", "none")
                    .attr("transform", "translate(0, -4)"); // Adjust to center in circle

                // Add hover effect
                backBtn.on("mouseenter", function () {
                    d3.select(this).select("circle").attr("fill", "rgba(255,255,255,0.3)");
                }).on("mouseleave", function () {
                    d3.select(this).select("circle").attr("fill", "rgba(255,255,255,0.1)");
                });

                // Shift text to the right
                labelG.append("text").attr("class", "level-label").attr("x", 35).attr("y", 25).text(level.level0);
            } else {
                labelG.append("text").attr("class", "level-label").attr("x", 20).attr("y", 25).text(level.level0);

                // Add tooltip prompt for drilldown?
                labelG.append("title").text("Double-click to drill down");
            }

            // Draw regular timeline bars
            const eventGroups = levelG.selectAll(".event-g")
                .data(level.events).enter().append("g").attr("class", "event-g")
                .attr("transform", d => `translate(${xScale(d.startDate)}, ${45 + d.rowIndex * (CONFIG.BAR_HEIGHT + CONFIG.BAR_SPACING)})`);

            const viewportWidth = this.container.node().clientWidth;
            const threshold = viewportWidth * 0.03;
            const triangleSize = 10;

            eventGroups.each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                const w = Math.max(0, xScale(d.endDate) - xScale(d.startDate));
                const isSmall = w < threshold;

                if (isSmall) {
                    // Render as instant event (Icon only)
                    const iconName = this.typeIcons[d.type ? d.type.toLowerCase() : ''];
                    let pathD = `M ${-triangleSize / 2},${-triangleSize} L ${triangleSize / 2},${-triangleSize} L 0,0 Z`;
                    let iconGroupTransform = "";

                    if (iconName && CONFIG.ICONS[iconName]) {
                        pathD = CONFIG.ICONS[iconName];
                        iconGroupTransform = "translate(-12, -26) scale(1)";
                    }

                    // Wrapper group for positioning (to avoid conflict with CSS hover transforms on path)
                    const iconWrapper = g.append("g")
                        .attr("transform", iconGroupTransform);

                    iconWrapper.append("path")
                        .attr("class", "event-triangle") // Reuse class for hover effects
                        .attr("d", pathD)
                        .attr("fill", getEventColor(d.type, this.typeColors))
                        .attr("stroke", "#fff")
                        .attr("stroke-width", 1.5)
                        .attr("data-id", d.id)
                        .style("cursor", "pointer")
                        .on("mouseenter", (e) => this.handleEventHover(e, d))
                        .on("mousemove", (e) => {
                            if (this.activeMapEventId || (this.tooltip.isLocked && this.tooltip.isLocked())) return;
                            this.tooltip.move(e);
                        })
                        .on("mouseleave", () => {
                            this.activeMapEventId = null;
                            this.tooltip.hide();
                        })
                        .on("contextmenu", (e) => {
                            e.preventDefault();
                            if (this.onEventContextMenu) {
                                this.onEventContextMenu(e, d);
                            }
                        });


                    // Label Above
                    g.append("text")
                        .attr("class", "event-label") // Use event-label to match point events
                        .attr("x", 0)
                        .attr("y", -triangleSize - 8)
                        .attr("text-anchor", "middle")
                        .attr("font-size", "9px")
                        .attr("fill", "var(--text-muted)")
                        .text(d.title.length > 15 ? d.title.substring(0, 12) + '...' : d.title);


                } else {
                    // Render as Bar
                    g.append("rect").attr("class", "event-bar")
                        .attr("height", CONFIG.BAR_HEIGHT).attr("fill", d => getEventColor(d.type, this.typeColors))
                        .attr("width", Math.max(8, w))
                        .attr("data-id", d.id)
                        .on("mouseenter", (e) => {
                            if (this.tooltip.isLocked && this.tooltip.isLocked()) return;
                            this.handleEventHover(e, d);
                        })
                        .on("mousemove", (e) => {
                            if (this.activeMapEventId || (this.tooltip.isLocked && this.tooltip.isLocked())) return;
                            this.tooltip.move(e);
                        })
                        .on("mouseleave", () => {
                            this.tooltip.hide();
                            this.activeMapEventId = null;
                        })
                        .on("contextmenu", (e) => {
                            e.preventDefault();
                            if (this.onEventContextMenu) {
                                this.onEventContextMenu(e, d);
                            }
                        });

                    // Draw Icon inside the bar
                    const iconName = this.typeIcons[d.type ? d.type.toLowerCase() : ''];
                    if (iconName && CONFIG.ICONS[iconName]) {
                        g.append("path")
                            .attr("class", "event-icon")
                            .attr("d", CONFIG.ICONS[iconName])
                            .attr("fill", "white")
                            .attr("fill-opacity", 0.9)
                            .attr("transform", "translate(6, 4) scale(0.7)") // Scale 24px to ~16.8px, fit in 24px bar
                            .style("pointer-events", "none");
                    }

                    // Label Below (Standard Bar Label)
                    g.append("text").attr("class", "bar-label")
                        .attr("x", 4)
                        .attr("y", CONFIG.BAR_HEIGHT + 16)
                        .text(d.title);
                }
            });

            // Draw event triangles (for point events without end dates)
            this.drawEventTriangles(levelG, level, xScale);
        });
    }

    drawEventTriangles(levelG, level, xScale) {
        if (!level.pointEvents || level.pointEvents.length === 0) {
            return; // No point events in this level
        }

        const triangleSize = 10; // Size of the triangle

        level.pointEvents.forEach(event => {
            const x = xScale(event.startDate);

            // Calculate Y based on the row index assigned by layout-engine
            // Position so tip touches top of the virtual bar
            const barY = level.topBarY + event.rowIndex * (CONFIG.BAR_HEIGHT + CONFIG.BAR_SPACING);

            // Use transform for positioning the entire group
            const triangleG = levelG.append("g")
                .attr("class", "event-triangle-group")
                .attr("transform", `translate(${x}, ${barY})`);

            // Create a downward-pointing triangle relative to (0,0) (the tip)
            // Points: top-left, top-right, bottom-center (0,0)
            let pathD = `M ${-triangleSize / 2},${-triangleSize} L ${triangleSize / 2},${-triangleSize} L 0,0 Z`;
            let iconGroupTransform = "";

            const iconName = this.typeIcons[event.type ? event.type.toLowerCase() : ''];
            if (iconName && CONFIG.ICONS[iconName]) {
                pathD = CONFIG.ICONS[iconName];
                // Icon is 24x24. We want to center it horizontally on (0,0) and have it sit on top of the line.
                // The line is at y=0.
                // So translate x by -12 to center.
                // Translate y by -24 to sit on top.
                iconGroupTransform = "translate(-12, -26) scale(1)";
            }

            // Create a wrapper group specifically for the icon/triangle path
            // This ensures static transforms (translate) are kept separate from CSS hover transforms (scale)
            const iconWrapper = triangleG.append("g")
                .attr("transform", iconGroupTransform);

            iconWrapper.append("path")
                .attr("class", "event-triangle")
                .attr("d", pathD)
                .attr("fill", getEventColor(event.type, this.typeColors))
                .attr("stroke", "#fff")
                .attr("stroke-width", 1.5)
                // transform attribute handled by wrapper
                .attr("data-id", event.id)
                .style("cursor", "pointer")
                .on("mouseenter", (e) => this.handleEventHover(e, event))
                .on("mousemove", (e) => {
                    if (this.activeMapEventId) return;
                    this.tooltip.move(e);
                })
                .on("mouseleave", () => {
                    this.activeMapEventId = null;
                    this.tooltip.hide();
                })
                .on("contextmenu", (e) => {
                    e.preventDefault();
                    if (this.onEventContextMenu) {
                        this.onEventContextMenu(e, event);
                    }
                });

            // Add a small label above the triangle
            triangleG.append("text")
                .attr("class", "event-label")
                .attr("x", 0) // Centered horizontally
                .attr("y", -triangleSize - 8) // Above the triangle
                .attr("text-anchor", "middle")
                .attr("font-size", "9px")
                .attr("fill", "var(--text-muted)")
                .text(event.title.length > 15 ? event.title.substring(0, 12) + '...' : event.title);
        });
    }

    drawSlider(svg) {
        const sliderX = this.xScale(this.sliderDate);
        const sliderG = svg.append("g").attr("class", "slider-group");
        sliderG.append("line").attr("class", "time-slider-line").attr("x1", sliderX).attr("x2", sliderX).attr("y1", CONFIG.PADDING.TOP - 30).attr("y2", this.totalHeight);
        sliderG.append("rect").attr("class", "time-slider-hitbox").attr("x", sliderX - 10).attr("y", CONFIG.PADDING.TOP - 40).attr("width", 20).attr("height", 30)
            ;
        sliderG.append("circle").attr("class", "time-slider-handle").attr("cx", sliderX).attr("cy", CONFIG.PADDING.TOP - 25).attr("r", 6).call(d3.drag().on("drag", (event) => {
            const newDate = this.xScale.invert(event.x);
            if (newDate >= this.xScale.domain()[0] && newDate <= this.xScale.domain()[1]) {
                this.sliderDate = newDate;
                this.updateSliderUI(sliderG);
                this.updateActiveEvents();
                this.keepSliderInView(false);
            }
        }));
    }

    updateSliderUI(sliderG) {
        const x = this.xScale(this.sliderDate);
        sliderG.select(".time-slider-line").attr("x1", x).attr("x2", x);
        sliderG.select(".time-slider-handle").attr("cx", x);
        sliderG.select(".time-slider-hitbox").attr("x", x - 10);
    }

    updateActiveEvents() {
        // Include both standard duration events and point events (like milestones)
        const allLayoutEvents = this.layoutData.flatMap(l => [...l.events, ...l.pointEvents]);

        const activeEvents = allLayoutEvents.filter(e =>
            this.sliderDate >= e.startDate && this.sliderDate <= e.endDate
        );

        this.container.selectAll(".event-bar")
            .classed("active", d => activeEvents.includes(d));

        if (this.onSliderMove) {
            this.onSliderMove(this.sliderDate, activeEvents);
        }
    }

    handleEventHover(e, d) {
        if (this.onEventHover) {
            this.onEventHover(e, d);
        }

        // Standard tooltip behavior (fallback or complementary)
        // If external handler returns true, skip default
        if (this.onEventHover && this.onEventHover(e, d) === true) {
            return;
        }

        const lat = parseFloat(d.lattitude || d.latitude);
        const lng = parseFloat(d.longitude || d.longtitude);
        const hasMap = !isNaN(lat) && !isNaN(lng);

        // Conditional logic: Show map in tooltip ONLY if panel is closed
        if (hasMap && !this.isMapPanelOpen) {
            this.activeMapEventId = d.id;
            const mapId = `map-${d.id}`;
            const content = `
                <span class="tooltip-title">${d.title}</span>
                <div style="margin-bottom:8px; font-size: 0.9em"><strong>Type:</strong> ${d.type} &middot; <strong>Period:</strong> ${d.start} to ${d.end || 'Ongoing'}</div>
                <div style="margin-bottom:10px">${d.description}</div>
                <div id="${mapId}" style="width: 400px; height: 300px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: #333;"></div>
             `;

            // Show interactive tooltip
            this.tooltip.show(e, content, true);

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
            this.activeMapEventId = null;

            // If local map is suppressed because panel is open, show hint?
            const mapHint = (hasMap && this.isMapPanelOpen) ? `<br><em style='color: #ccc; font-size: 0.8em'>Shown on map panel</em>` : "";

            // Icon for Tooltip
            const iconName = this.typeIcons && this.typeIcons[d.type ? d.type.toLowerCase() : ''];
            const iconHtml = (iconName && CONFIG.ICONS[iconName]) ?
                `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: sub; margin-right: 6px; fill: currentColor;"><path d="${CONFIG.ICONS[iconName]}"></path></svg>` :
                '';

            const content = `<span class="tooltip-title">${iconHtml}${d.title}</span>` +
                `<strong>Type:</strong> ${d.type}<br>` +
                `<strong>Period:</strong> ${d.start} to ${d.end || 'Ongoing'}<br><br>` +
                `${d.description}${mapHint}`;

            this.tooltip.show(e, content, false);
        }
    }

    highlightEvent(id) {
        // Highlight bars
        this.container.selectAll(`.event-bar[data-id="${id}"]`)
            .classed("highlighted", true)
            .style("stroke", "#fff")
            .style("stroke-width", "3px")
            .style("filter", "brightness(1.5) drop-shadow(0 0 10px var(--primary))");

        // Highlight triangles
        this.container.selectAll(`.event-triangle[data-id="${id}"]`)
            .classed("highlighted", true)
            .style("stroke-width", "3px")
            .style("filter", "brightness(1.5) drop-shadow(0 0 10px var(--primary))");
    }

    unhighlightEvent(id) {
        // Reset bars
        this.container.selectAll(`.event-bar[data-id="${id}"]`)
            .classed("highlighted", false)
            .style("stroke", null)
            .style("stroke-width", null)
            .style("filter", null);

        // Reset triangles
        this.container.selectAll(`.event-triangle[data-id="${id}"]`)
            .classed("highlighted", false)
            .style("stroke-width", "1.5px")
            .style("filter", null);
    }
}
