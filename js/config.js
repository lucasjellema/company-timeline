export const CONFIG = {
    PADDING: {
        TOP: 80,
        RIGHT: 40,
        BOTTOM: 40,
        LEFT: 120
    },
    BAR_HEIGHT: 24,
    BAR_SPACING: 30,
    LEVEL_SPACING: 60,
    COLORS: {
        training: '#10B981',   // Emerald
        release: '#F59E0B',    // Amber
        project: '#6366F1',    // Indigo
        sprint: '#EC4899',     // Pink
        default: '#94A3B8'     // Slate
    },
    TYPE_COLORS: {
        training: '#10B981',
        release: '#F59E0B',
        project: '#6366F1',
        sprint: '#EC4899'
    }
};

export const SAMPLE_CSV = `start,end,title,description,type,level0,level1,level2
2022-01,2024-12,Vision 2024,Strategic roadmap for company growth,project,company,strategy,global
2023-03,2023-05,Q1 Release,Core platform stabilization and features,release,company,platform,core
2023-06,2023-08,Summer Sprint,Performance optimization phase,sprint,company,platform,ops
2024-01,2024-03,AI Integration,Deploying LLMs across internal tools,project,company,R&D,ai
2023-02,2023-03,Manager Training,Leadership development workshop,training,HR,culture,mgmt
2023-04,2023-06,New Hire Onboarding,Batch 1 training program,training,HR,onboarding,batch1
2023-08,2023-10,Feedback Cycle,Annual performance review and planning,project,HR,ops,reviews
2023-01,2023-06,Cloud Migration,Moving data centers to AWS,project,IT,infrastructure,cloud
2023-07,2023-12,Security Audit,SOC2 compliance and remediation,project,IT,security,audit
2024-02,2025-04,Network Upgrade,Fiber installation across campuses,project,IT,infrastructure,net
2024-07,2025-03,Network Check,Check for quality and speed,project,IT,infrastructure,net
`;
