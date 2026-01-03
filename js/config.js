export const CONFIG = {
    // Padding around the main SVG visualization
    PADDING: {
        TOP: 80,    // Space at the top for time axis and headers
        RIGHT: 40,  // Space on the right side
        BOTTOM: 40, // Space at the bottom
        LEFT: 120   // Space on the left for Level 0 category labels
    },

    // Dimensions for event bars
    BAR_HEIGHT: 24,   // Height of each event bar in pixels
    BAR_SPACING: 45, // Vertical distance between two parallel level1 bars in the same level0 group
    LEVEL_SPACING: 60,// Vertical gap between major Level 0 categories
    LEVEL_COLLAPSED_HEIGHT: 40, // Height of a collapsed Level 0 category

    // Default color palette for events
    COLORS: {
        training: '#10B981',   // Emerald
        release: '#F59E0B',    // Amber
        project: '#6366F1',    // Indigo
        sprint: '#EC4899',     // Pink
        default: '#94A3B8'     // Slate
    },

    // Specific color mapping by event type
    TYPE_COLORS: {
        training: '#10B981',
        release: '#F59E0B',
        project: '#6366F1',
        sprint: '#EC4899'
    },
    // SVG path data for various icons used in point events or bar overlays
    ICONS: {
        star: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
        circle: "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2z",
        diamond: "M12 2l10 10-10 10L2 12z",
        flag: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z",
        heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
        check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
        cross: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
        square: "M3 3h18v18H3z",
        triangle: "M12 2L2 22h20L12 2z",
        user: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
        camera: "M9.4 5l-1.13 2H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2h-3.27l-1.13-2H9.4zM12 17c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z",
        flask: "M19.07 15.82l-5.31-9.67V2H18V0H6v2h4.25v4.15l-5.32 9.67C4.19 17.26 5.23 19 6.94 19h10.12c1.71 0 2.75-1.74 2.01-3.18z",
        bulb: "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z",
        birth: "M12 2c-4 0-7.5 3-7.5 7 0 1.5 0.5 3 1.5 4.5L5 14v5h3v-2h2v2h2v-2h2v2h3v-5l-1-0.5c1-1.5 1.5-3 1.5-4.5C20.5 5 17 2 12 2z M12 5c1 0 2 1 2 2s-1 2-2 2s-2-1-2-2S11 5 12 5z", // Simplified baby/swaddle
        death: "M12 2c-4.42 0-8 3.58-8 8v12h16V10c0-4.42-3.58-8-8-8zm1 16h-2v-3h-2v-2h2V9h2v4h2v2h-2V18z", // Tombstone with cross
        battle: "M14.5 10.5l-2.5 2.5l-5-5l5-5l2.5 2.5L14.5 10.5z M4 20l5-5l2.5 2.5l-5 5L4 20z", // Basic crossed shape approximation
        treaty: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z", // Scroll
        ascension: "M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11h-14zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z", // Crown
        discovery: "M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z", // Map
        house: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
        school: "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z",
        sport: "M20.2 2H3.8c-1.1 0-2 .9-2 2v3.5C1.8 13 6.3 17 12 17s10.2-4 10.2-9.5V4c0-1.1-.9-2-2-2zM10 19h4v2h-4z", // Trophy
        music: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
        painting: "M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zM20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z",
        sculpture: "M4 10v7h3v-7H4zm6 0v7h3v-7h-3zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm3-19L12 2l7 5H5v-2z",
        election: "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z M7 15h10v2H7z M7 11h10v2H7z M7 7h10v2H7z",
        money: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
        car: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
        airplane: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
        rocket: "M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05c.47-.47 1.15-.68 1.81-.55zM11.17 17s3.74-1.55 5.89-3.7c5.4-5.4 4.5-9.62 4.21-10.94-.23-1.03-1.03-1.84-2.06-2.06-1.31-.29-5.54-1.18-10.94 4.21-2.15 2.15-3.7 5.89-3.7 5.89L11.17 17zm6.48-2.19c-2.29 2.04-5.58 3.44-5.89 3.57L13.31 22l4.05-4.05c.47-.47.68-1.15.55-1.81zM9 12c0 1.66-1.34 3-3 3S3 13.66 3 12s1.34-3 3-3 3 1.34 3 3z",
        cart: "M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z",
        legal: "M1 21h12v2H1zM5.245 8.07l2.83-2.827 14.14 14.142-2.828 2.828zM12.317 1l5.657 5.656-2.83 2.83-5.654-5.66zM3.825 9.485l5.657 5.657-2.828 2.828-5.657-5.657z"
    },
    // 1.0-1.5x: Years
    // 1.5-3x: Quarters
    // 3-8x: Months
    // 8x+: Weeks
    // Configuration for Semantic Zoom (switching granularity based on zoom level)
    ZOOM_GRANULARITY: {
        WEEKLY_THRESHOLD: 12, // Zoom factor threshold to switch to Weekly view
        MONTHLY_THRESHOLD: 6, // Zoom factor threshold to switch to Monthly view
        QUARTERLY_THRESHOLD: 3 // Zoom factor threshold to switch to Quarterly view
    }
};

export const SAMPLE_CSV = `start,end,title,description,type,level0,level1,level2,lattitude,longitude
2022-01,2024-12,Vision 2024,Strategic roadmap for company growth,project,company,strategy,global,58.6436,-0.1252
2023-03,2023-05,Q1 Release,Core platform stabilization and features,release,company,platform,core
2023-04-24,,Party!,Much fun,other,company,platform,core
2023-06,2023-08,Summer Sprint,Performance optimization phase,sprint,company,platform,ops
2024-01,2024-03,AI Integration,Deploying LLMs across internal tools,project,company,R&D,ai
2024-07-06,,Kick Off AI Integration,One Day Off Site Event,project,IT,security,audit,57.7749,1.231
2023-02,2023-03,Manager Training,Leadership development workshop,training,HR,culture,mgmt
2023-04,2023-06,New Hire Onboarding,Batch 1 training program,training,HR,onboarding,batch1,37.7749,-122.4194
2023-08,2023-10,Feedback Cycle,Annual performance review and planning,project,HR,ops,reviews
2023-01,2023-06,Cloud Migration,Moving data centers to AWS,project,IT,infrastructure,cloud
2023-07,2023-12,Security Audit,SOC2 compliance and remediation,project,IT,security,audit
2024-02,2025-04,Network Upgrade,Fiber installation across campuses,project,IT,infrastructure,net
2024-07,2025-03,Network Check,Check for quality and speed,project,IT,infrastructure,net
2023-09-15,,Product Launch,Official launch of Version 3.0,release,company,product,launch
2023-09-15,,Product Launch,Official launch of Version 3.0 to the public.,release,company,product,launch,40.7128,-74.0060
2024-01-01,,New Year Kickoff,Company-wide meeting and strategy session for 2024.,project,company,strategy,kickoff,51.5074,-0.1278
17-03-2025,,Major Milestone,Company reaches 1 million users.,project,company,growth,milestone,,
`;
