import { CONFIG } from './config.js';
import { getEventColor } from './utils.js';

const CONSTANTS = {
    // Layout constants for the timeline levels (L0, L1, etc. containers)
    LEVEL: {
        BG_HEIGHT_OFFSET: 15,     // Reduction in height for the level background rect (padding at bottom)
        SEPARATOR_OFFSET: 10,     // Vertical offset from bottom for the separator line
        TITLE_X_DEFAULT: 20,      // X position of the level title text in normal view
        TITLE_X_DRILLED: 35,      // X position of the level title text when drilled down (shifted for back button)
        TITLE_Y: 25,              // Y position of the level title text
        BACK_BTN_OFFSET_Y: 15     // Y offset for the back button group relative to the label group
    },
    // Constants for the "Back" button appearing when drilled down
    BACK_BUTTON: {
        RADIUS: 10,               // Radius of the back button circle
        CX: 10,                   // Center X of the back button circle
        CY: 5,                    // Center Y of the back button circle
        FILL_DEFAULT: "var(--bg-active)", // Default background color
        FILL_HOVER: "var(--primary-light)",   // Background color on hover
        STROKE: "var(--text-muted)",           // Stroke color for the button circle
        STROKE_WIDTH: 1,          // Stroke width for the button circle
        ICON_PATH: "M 12 5 L 8 9 L 12 13",     // SVG path data for the left arrow icon
        ICON_STROKE: "var(--text-main)",      // Color of the arrow icon
        ICON_FILL: "none",        // Fill of the arrow icon (none since it's a line)
        ICON_TRANSLATE: "translate(0, -4)"     // Adjustment to center the arrow within the circle
    },
    // Tooltip related constants
    TOOLTIP: {
        PROMPT: "Double-click to drill down"   // Tooltip text for level labels
    },
    // Event rendering constants (Bars and Points)
    EVENT: {
        START_Y_OFFSET: 50,       // Vertical offset where the first row of events starts within a level
        SMALL_THRESHOLD: 0.03,    // Events taking up less than 3% of viewport width are rendered as icons/points
        TRIANGLE_SIZE: 10,        // Size of the triangle shape for point events
        ICON_OFFSET_X: -12,       // Horizontal offset to center a 24px icon
        ICON_OFFSET_Y: -19,       // Vertical offset to make the icon sit on top of the timeline row
        ICON_STROKE: "var(--text-main)",      // Stroke color for event icons/shapes
        ICON_STROKE_WIDTH: 1.5,   // Stroke width for event icons/shapes
        LABEL_Y_OFFSET_GAP: 8,    // Gap between the icon and the text label
        LABEL_Y_OFFSET_EXTRA: 2, // Additional offset for label positioning
        LABEL_FONT_SIZE: "9px",   // Font size for event labels
        LABEL_COLOR: "var(--text-muted)",      // CSS variable for label color
        LABEL_TRUNCATE_LIMIT: 15, // Character count threshold to trigger truncation
        LABEL_TRUNCATE_LENGTH: 12,// Number of characters to keep when truncating
        BAR_MIN_WIDTH: 8,         // Minimum width in pixels for an event bar
        BAR_ICON_OPACITY: 0.9,    // Opacity of the icon inside an event bar
        BAR_ICON_TRANSFORM: "translate(6, 4) scale(0.7)", // Positioning and scaling for icon inside bar
        BAR_ICON_FILL: "white",   // Color of the icon inside the bar (Keep white for contrast on colored bars)

        BAR_LABEL_X_OFFSET: 4,    // Horizontal padding for the label inside the bar
        BAR_LABEL_Y_PAD: 10       // Vertical padding for the label relative to bar height
    }
};

export function drawLevelsAndEvents(renderer, svg, layoutData, xScale) {
    layoutData.forEach((level) => {
        const levelG = svg.append("g").attr("transform", `translate(0, ${level.yStart})`);

        levelG.append("rect")
            .attr("class", "level-bg")
            .attr("width", renderer.width)
            .attr("height", level.height - CONSTANTS.LEVEL.BG_HEIGHT_OFFSET);

        levelG.append("line")
            .attr("class", "level-separator")
            .attr("x1", 0)
            .attr("x2", renderer.width)
            .attr("y1", level.height - CONSTANTS.LEVEL.SEPARATOR_OFFSET)
            .attr("y2", level.height - CONSTANTS.LEVEL.SEPARATOR_OFFSET);

        // Level Label Group with Interaction
        const labelG = levelG.append("g")
            .attr("class", "level-title-group")
            .style("cursor", "pointer")
            .on("dblclick", (e) => {
                e.stopPropagation();
                if (renderer.onCategoryDblClick) {
                    renderer.onCategoryDblClick(level.level0);
                }
            })
            .on("contextmenu", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (renderer.onCategoryContextMenu) {
                    renderer.onCategoryContextMenu(e, level.level0);
                }
            });

        // Back Button (only if drilled down and callback exists)
        if (renderer.isDrilledDown) {
            const backBtn = labelG.append("g")
                .attr("class", "back-button-icon")
                .attr("transform", `translate(0, ${CONSTANTS.LEVEL.BACK_BTN_OFFSET_Y})`) // Positioned relative to text baseline
                .on("click", (e) => {
                    e.stopPropagation();
                    if (renderer.onBackButtonClick) renderer.onBackButtonClick();
                });

            // Circle background
            backBtn.append("circle")
                .attr("r", CONSTANTS.BACK_BUTTON.RADIUS)
                .attr("cx", CONSTANTS.BACK_BUTTON.CX)
                .attr("cy", CONSTANTS.BACK_BUTTON.CY)
                .attr("fill", CONSTANTS.BACK_BUTTON.FILL_DEFAULT)
                .attr("stroke", CONSTANTS.BACK_BUTTON.STROKE)
                .attr("stroke-width", CONSTANTS.BACK_BUTTON.STROKE_WIDTH);

            // Arrow Path
            backBtn.append("path")
                .attr("d", CONSTANTS.BACK_BUTTON.ICON_PATH) // Simple Left Arrow
                .attr("stroke", CONSTANTS.BACK_BUTTON.ICON_STROKE)
                .attr("fill", CONSTANTS.BACK_BUTTON.ICON_FILL)
                .attr("transform", CONSTANTS.BACK_BUTTON.ICON_TRANSLATE); // Adjust to center in circle

            // Add hover effect
            backBtn.on("mouseenter", function () {
                d3.select(this).select("circle").attr("fill", CONSTANTS.BACK_BUTTON.FILL_HOVER);
            }).on("mouseleave", function () {
                d3.select(this).select("circle").attr("fill", CONSTANTS.BACK_BUTTON.FILL_DEFAULT);
            });

            // Shift text to the right
            labelG.append("text")
                .attr("class", "level-label")
                .attr("x", CONSTANTS.LEVEL.TITLE_X_DRILLED)
                .attr("y", CONSTANTS.LEVEL.TITLE_Y)
                .text(level.level0);
        } else {
            const titleText = level.collapsed ? `${level.level0} (+)` : level.level0;
            labelG.append("text")
                .attr("class", "level-label")
                .attr("x", CONSTANTS.LEVEL.TITLE_X_DEFAULT)
                .attr("y", CONSTANTS.LEVEL.TITLE_Y)
                .style("font-style", level.collapsed ? "italic" : "normal")
                .style("opacity", level.collapsed ? 0.7 : 1)
                .text(titleText);

            // Add tooltip prompt for drilldown?
            labelG.append("title").text("Double-click to drill down, right-click to toggle collapse");
        }

        if (level.collapsed) {
            // Do not return. We want to draw visible events for collapsed groups.
            // Logic upstream (layout-engine) has already filtered 'active' events for this level.
        }

        const eventsToDraw = level.events.filter(d => {
            if (renderer.hiddenEventIds && renderer.hiddenEventIds.has(d.id)) return false;
            return true;
        });

        // Draw regular timeline bars
        // TODO not every group has both bars and icons; therefore the translation will often be too large
        const eventGroups = levelG.selectAll(".event-g")
            .data(eventsToDraw).enter().append("g").attr("class", "event-g")
            .attr("transform", d => `translate(${xScale(d.startDate)}, ${CONSTANTS.EVENT.START_Y_OFFSET + d.rowIndex * (CONFIG.BAR_HEIGHT + CONFIG.BAR_SPACING)})`);

        const viewportWidth = renderer.container.node().clientWidth;
        const threshold = viewportWidth * CONSTANTS.EVENT.SMALL_THRESHOLD;
        const triangleSize = CONSTANTS.EVENT.TRIANGLE_SIZE;

        eventGroups.each((d, i, nodes) => {
            const g = d3.select(nodes[i]);

            // Highlight Logic
            let opacity = 1;
            let isHighlighted = false;
            if (renderer.highlightedEventIds && renderer.highlightedEventIds.size > 0) {
                if (!renderer.highlightedEventIds.has(d.id)) {
                    opacity = 0.1; // Dim non-matching
                } else {
                    isHighlighted = true;
                }
            }
            g.style("opacity", opacity);

            const w = Math.max(0, xScale(d.endDate) - xScale(d.startDate));
            const isSmall = w < threshold;

            if (isSmall) {
                // Render as instant event (Icon only)
                const iconName = d.icon || renderer.typeIcons[d.type ? d.type.toLowerCase() : ''];
                let pathD = `M ${-triangleSize / 2},${-triangleSize} L ${triangleSize / 2},${-triangleSize} L 0,0 Z`;
                let iconGroupTransform = "";

                if (iconName && CONFIG.ICONS[iconName]) {
                    pathD = CONFIG.ICONS[iconName];
                    iconGroupTransform = `translate(${CONSTANTS.EVENT.ICON_OFFSET_X}, ${CONSTANTS.EVENT.ICON_OFFSET_Y}) scale(1)`;
                }

                // Wrapper group for positioning (to avoid conflict with CSS hover transforms on path)
                // Check for overlapping "parent" bars to lift this icon
                let liftY = 0;
                // Only lift if we are seemingly on a lower row (higher index) than 0
                if (d.rowIndex > 0) {
                    const overlappingBar = eventsToDraw.find(b => {
                        if (b.id === d.id) return false;
                        if (b.rowIndex >= d.rowIndex) return false; // Must be "above"

                        // Check if b is NOT small (is a bar)
                        const wB = Math.max(0, xScale(b.endDate) - xScale(b.startDate));
                        if (wB < threshold) return false;

                        // Check Same Level 1
                        if ((b.level1 || "") !== (d.level1 || "")) return false;

                        // Check overlap
                        return d.startDate < b.endDate && d.endDate > b.startDate;
                    });

                    if (overlappingBar) {
                        liftY = (d.rowIndex - overlappingBar.rowIndex) * (CONFIG.BAR_HEIGHT + CONFIG.BAR_SPACING);
                    }
                }

                const iconWrapper = g.append("g")
                    .attr("transform", iconGroupTransform); // Initial transform

                // If we need to lift, modify the transform. 
                // We parse the existing translate or just build a new string.
                // iconGroupTransform is "translate(x, y) scale(1)"
                if (liftY > 0) {
                    // Re-calculate transform with lift
                    let baseX = CONSTANTS.EVENT.ICON_OFFSET_X;
                    let baseY = CONSTANTS.EVENT.ICON_OFFSET_Y;
                    if (!iconName) {
                        baseX = 0;
                        baseY = 0;
                    }

                    if (iconName && CONFIG.ICONS[iconName]) {
                        iconWrapper.attr("transform", `translate(${CONSTANTS.EVENT.ICON_OFFSET_X}, ${CONSTANTS.EVENT.ICON_OFFSET_Y - liftY}) scale(1)`);
                    } else {
                        // Default triangle
                        iconWrapper.attr("transform", `translate(0, ${-liftY})`);
                    }
                }

                iconWrapper.append("path")
                    .attr("class", "event-triangle") // Reuse class for hover effects
                    .attr("d", pathD)
                    .attr("fill", d.color || getEventColor(d.type, renderer.typeColors))
                    .attr("stroke", isHighlighted ? "var(--text-main)" : CONSTANTS.EVENT.ICON_STROKE) // Highlight stroke
                    .attr("stroke-width", isHighlighted ? 2.5 : CONSTANTS.EVENT.ICON_STROKE_WIDTH)
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
                    })
                    .on("dblclick", (e) => {
                        e.stopPropagation();
                        if (renderer.onEventDblClick) {
                            renderer.onEventDblClick(e, d);
                        }
                    });


                // Label Above
                g.append("text")
                    .attr("class", "event-label") // Use event-label to match point events
                    .attr("x", 0)
                    .attr("y", -triangleSize - CONSTANTS.EVENT.LABEL_Y_OFFSET_GAP - CONSTANTS.EVENT.LABEL_Y_OFFSET_EXTRA - liftY) // Lift label too!
                    .attr("text-anchor", "middle")
                    .attr("font-size", CONSTANTS.EVENT.LABEL_FONT_SIZE)
                    .attr("fill", isHighlighted ? "var(--text-main)" : CONSTANTS.EVENT.LABEL_COLOR) // Highlight text
                    .attr("font-weight", isHighlighted ? "bold" : "normal")
                    .text(d.title.length > CONSTANTS.EVENT.LABEL_TRUNCATE_LIMIT ? d.title.substring(0, CONSTANTS.EVENT.LABEL_TRUNCATE_LENGTH) + '...' : d.title);


            } else {
                // Render as Bar
                g.append("rect").attr("class", "event-bar")
                    .attr("height", CONFIG.BAR_HEIGHT).attr("fill", d => d.color || getEventColor(d.type, renderer.typeColors))
                    .attr("width", Math.max(CONSTANTS.EVENT.BAR_MIN_WIDTH, w))
                    .attr("stroke", isHighlighted ? "var(--text-main)" : "none") // Highlight stroke
                    .attr("stroke-width", isHighlighted ? 2 : 0)
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
                    })
                    .on("dblclick", (e) => {
                        e.stopPropagation();
                        if (renderer.onEventDblClick) {
                            renderer.onEventDblClick(e, d);
                        }
                    });

                // Draw Icon inside the bar
                const iconName = d.icon || renderer.typeIcons[d.type ? d.type.toLowerCase() : ''];
                if (iconName && CONFIG.ICONS[iconName]) {
                    g.append("path")
                        .attr("class", "event-icon")
                        .attr("d", CONFIG.ICONS[iconName])
                        .attr("fill", CONSTANTS.EVENT.BAR_ICON_FILL)
                        .attr("fill-opacity", CONSTANTS.EVENT.BAR_ICON_OPACITY)
                        .attr("transform", CONSTANTS.EVENT.BAR_ICON_TRANSFORM)
                        .style("pointer-events", "none");
                }

                // Label Below (Standard Bar Label)
                g.append("text").attr("class", "bar-label")
                    .attr("x", CONSTANTS.EVENT.BAR_LABEL_X_OFFSET)
                    .attr("y", CONFIG.BAR_HEIGHT + CONSTANTS.EVENT.BAR_LABEL_Y_PAD)
                    .attr("fill", isHighlighted ? "var(--text-main)" : undefined) // Highlight text (default color handled by CSS usually, but explicit override helps)
                    .attr("font-weight", isHighlighted ? "bold" : "normal")
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

    const triangleSize = CONSTANTS.EVENT.TRIANGLE_SIZE;

    level.pointEvents.forEach(event => {
        if (renderer.hiddenEventIds && renderer.hiddenEventIds.has(event.id)) return;

        const x = xScale(event.startDate);

        if (isNaN(x)) return; // Skip if date invalid (redundant check but safe)

        // Calculate Y based on the row index assigned by layout-engine
        // Position so tip touches top of the virtual bar
        const barY = level.topBarY + event.rowIndex * (CONFIG.BAR_HEIGHT + CONFIG.BAR_SPACING);

        // Use transform for positioning the entire group
        const triangleG = levelG.append("g")
            .attr("class", "event-triangle-group")
            .attr("transform", `translate(${x}, ${barY})`);

        // Highlight Logic
        let opacity = 1;
        let isHighlighted = false;
        if (renderer.highlightedEventIds && renderer.highlightedEventIds.size > 0) {
            if (!renderer.highlightedEventIds.has(event.id)) {
                opacity = 0.1; // Dim non-matching
            } else {
                isHighlighted = true;
            }
        }
        triangleG.style("opacity", opacity);

        // Create a downward-pointing triangle relative to (0,0) (the tip)
        // Points: top-left, top-right, bottom-center (0,0)
        let pathD = `M ${-triangleSize / 2},${-triangleSize} L ${triangleSize / 2},${-triangleSize} L 0,0 Z`;
        let iconGroupTransform = "";

        const iconName = event.icon || renderer.typeIcons[event.type ? event.type.toLowerCase() : ''];
        if (iconName && CONFIG.ICONS[iconName]) {
            pathD = CONFIG.ICONS[iconName];
            // Icon is 24x24. We want to center it horizontally on (0,0) and have it sit on top of the line.
            // The line is at y=0.
            // So translate x by -12 to center.
            // Translate y by -24 to sit on top.
            iconGroupTransform = `translate(${CONSTANTS.EVENT.ICON_OFFSET_X}, ${CONSTANTS.EVENT.ICON_OFFSET_Y}) scale(1)`;
        }

        // Create a wrapper group specifically for the icon/triangle path
        // This ensures static transforms (translate) are kept separate from CSS hover transforms (scale)
        const iconWrapper = triangleG.append("g")
            .attr("transform", iconGroupTransform);

        iconWrapper.append("path")
            .attr("class", "event-triangle")
            .attr("d", pathD)
            .attr("fill", event.color || getEventColor(event.type, renderer.typeColors))
            .attr("stroke", isHighlighted ? "var(--text-main)" : CONSTANTS.EVENT.ICON_STROKE) // Highlight stroke
            .attr("stroke-width", isHighlighted ? 2.5 : CONSTANTS.EVENT.ICON_STROKE_WIDTH)
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
            })
            .on("dblclick", (e) => {
                e.stopPropagation();
                if (renderer.onEventDblClick) {
                    renderer.onEventDblClick(e, event);
                }
            });

        // Add a small label above the triangle
        triangleG.append("text")
            .attr("class", "event-label")
            .attr("x", 0) // Centered horizontally
            .attr("y", -triangleSize - CONSTANTS.EVENT.LABEL_Y_OFFSET_GAP - CONSTANTS.EVENT.LABEL_Y_OFFSET_EXTRA) // Above the triangle
            .attr("text-anchor", "middle")
            .attr("font-size", CONSTANTS.EVENT.LABEL_FONT_SIZE)
            .attr("fill", isHighlighted ? "var(--text-main)" : CONSTANTS.EVENT.LABEL_COLOR) // Highlight text
            .attr("font-weight", isHighlighted ? "bold" : "normal")
            .text(event.title.length > CONSTANTS.EVENT.LABEL_TRUNCATE_LIMIT ? event.title.substring(0, CONSTANTS.EVENT.LABEL_TRUNCATE_LENGTH) + '...' : event.title);
    });
}
