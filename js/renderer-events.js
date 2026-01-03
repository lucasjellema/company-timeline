import { CONFIG } from './config.js';
import { getEventColor } from './utils.js';

export function drawLevelsAndEvents(renderer, svg, layoutData, xScale) {
    layoutData.forEach((level) => {
        const levelG = svg.append("g").attr("transform", `translate(0, ${level.yStart})`);

        levelG.append("rect").attr("class", "level-bg").attr("width", renderer.width).attr("height", level.height - 15);
        levelG.append("line").attr("class", "level-separator").attr("x1", 0).attr("x2", renderer.width).attr("y1", level.height - 10).attr("y2", level.height - 10);
        // Level Label Group with Interaction
        const labelG = levelG.append("g")
            .attr("class", "level-title-group")
            .style("cursor", "pointer")
            .on("dblclick", (e) => {
                e.stopPropagation();
                if (renderer.onCategoryDblClick) {
                    renderer.onCategoryDblClick(level.level0);
                }
            });

        // Back Button (only if drilled down and callback exists)
        if (renderer.isDrilledDown) {
            const backBtn = labelG.append("g")
                .attr("class", "back-button-icon")
                .attr("transform", "translate(0, 15)") // Positioned relative to text baseline
                .on("click", (e) => {
                    e.stopPropagation();
                    if (renderer.onBackButtonClick) renderer.onBackButtonClick();
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

        const viewportWidth = renderer.container.node().clientWidth;
        const threshold = viewportWidth * 0.03;
        const triangleSize = 10;

        eventGroups.each((d, i, nodes) => {
            const g = d3.select(nodes[i]);
            const w = Math.max(0, xScale(d.endDate) - xScale(d.startDate));
            const isSmall = w < threshold;

            if (isSmall) {
                // Render as instant event (Icon only)
                const iconName = renderer.typeIcons[d.type ? d.type.toLowerCase() : ''];
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
                    .attr("fill", getEventColor(d.type, renderer.typeColors))
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1.5)
                    .attr("data-id", d.id)
                    .style("cursor", "pointer")
                    .on("mouseenter", (e) => renderer.handleEventHover(e, d))
                    .on("mousemove", (e) => {
                        if (renderer.activeMapEventId || (renderer.tooltip.isLocked && renderer.tooltip.isLocked())) return;
                        renderer.tooltip.move(e);
                    })
                    .on("mouseleave", () => {
                        renderer.activeMapEventId = null;
                        renderer.tooltip.hide();
                    })
                    .on("contextmenu", (e) => {
                        e.preventDefault();
                        if (renderer.onEventContextMenu) {
                            renderer.onEventContextMenu(e, d);
                        }
                    });


                // Label Above
                g.append("text")
                    .attr("class", "event-label") // Use event-label to match point events
                    .attr("x", 0)
                    .attr("y", -triangleSize - 8 - 10) // added -4 for icons i/o triangle 
                    .attr("text-anchor", "middle")
                    .attr("font-size", "9px")
                    .attr("fill", "var(--text-muted)")
                    .text(d.title.length > 15 ? d.title.substring(0, 12) + '...' : d.title);


            } else {
                // Render as Bar
                g.append("rect").attr("class", "event-bar")
                    .attr("height", CONFIG.BAR_HEIGHT).attr("fill", d => getEventColor(d.type, renderer.typeColors))
                    .attr("width", Math.max(8, w))
                    .attr("data-id", d.id)
                    .on("mouseenter", (e) => {
                        if (renderer.tooltip.isLocked && renderer.tooltip.isLocked()) return;
                        renderer.handleEventHover(e, d);
                    })
                    .on("mousemove", (e) => {
                        if (renderer.activeMapEventId || (renderer.tooltip.isLocked && renderer.tooltip.isLocked())) return;
                        renderer.tooltip.move(e);
                    })
                    .on("mouseleave", () => {
                        renderer.tooltip.hide();
                        renderer.activeMapEventId = null;
                    })
                    .on("contextmenu", (e) => {
                        e.preventDefault();
                        if (renderer.onEventContextMenu) {
                            renderer.onEventContextMenu(e, d);
                        }
                    });

                // Draw Icon inside the bar
                const iconName = renderer.typeIcons[d.type ? d.type.toLowerCase() : ''];
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
        drawEventTriangles(renderer, levelG, level, xScale);
    });
}

function drawEventTriangles(renderer, levelG, level, xScale) {
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

        const iconName = renderer.typeIcons[event.type ? event.type.toLowerCase() : ''];
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
            .attr("fill", getEventColor(event.type, renderer.typeColors))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            // transform attribute handled by wrapper
            .attr("data-id", event.id)
            .style("cursor", "pointer")
            .on("mouseenter", (e) => renderer.handleEventHover(e, event))
            .on("mousemove", (e) => {
                if (renderer.activeMapEventId) return;
                renderer.tooltip.move(e);
            })
            .on("mouseleave", () => {
                renderer.activeMapEventId = null;
                renderer.tooltip.hide();
            })
            .on("contextmenu", (e) => {
                e.preventDefault();
                if (renderer.onEventContextMenu) {
                    renderer.onEventContextMenu(e, event);
                }
            });

        // Add a small label above the triangle
        triangleG.append("text")
            .attr("class", "event-label")
            .attr("x", 0) // Centered horizontally
            .attr("y", -triangleSize - 8 - 10) // Above the triangle
            .attr("text-anchor", "middle")
            .attr("font-size", "9px")
            .attr("fill", "var(--text-muted)")
            .text(event.title.length > 15 ? event.title.substring(0, 12) + '...' : event.title);
    });
}
