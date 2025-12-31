# Testing Zoom Granularity Feature

## Overview
The timeline now features **adaptive zoom granularity** that automatically adjusts the timeline detail level as you zoom in and out.

## How to Test

1. **Open the Application**
   - Navigate to http://localhost:8080 in your browser

2. **Initial View (Quarters)**
   - At the default zoom level (1x), you should see quarterly markers
   - Look for labels like "Q1", "Q2", "Q3", "Q4" on the timeline axis
   - Year labels (e.g., "2023", "2024") should appear at the start of each year

3. **Zoom In - Transition to Months**
   - Click the **Zoom In (+)** button 3-4 times
   - The timeline should transition to show monthly granularity
   - Look for month abbreviations: "Jan", "Feb", "Mar", etc.
   - Year labels still appear in January

4. **Zoom In Further - Transition to Weeks**
   - Continue clicking the **Zoom In (+)** button several more times
   - At 8x zoom or higher, the timeline switches to weekly granularity
   - Look for specific dates like "Jan 1", "Jan 8", "Jan 15", etc.
   - This shows individual weeks with month and day

5. **Zoom Out - Reverse Transitions**
   - Click the **Zoom Out (-)** button repeatedly
   - Observe the transitions in reverse:
     - Weeks → Months → Quarters → Years
   - Each transition should be smooth and automatic

## Expected Granularity Levels

| Zoom Level | Granularity | What You See |
|------------|-------------|--------------|
| 1.0x - 1.5x | **Years** | Only year markers (2022, 2023, 2024) |
| 1.5x - 3.0x | **Quarters** | Q1, Q2, Q3, Q4 markers with years |
| 3.0x - 8.0x | **Months** | Jan, Feb, Mar... with years |
| 8.0x+ | **Weeks** | Specific dates (Jan 1, Jan 8, Jan 15...) |

## Visual Indicators

- **Grid Lines**: Year boundaries have stronger opacity (0.3) compared to other markers
- **Quarter Lines**: In quarterly view, quarter boundaries have medium opacity (0.15)
- **Font Weight**: Year labels are bold (weight: 700), other labels are regular (weight: 400)

## Configuration

The zoom thresholds are defined in `js/config.js`:
```javascript
ZOOM_GRANULARITY: {
    WEEKLY_THRESHOLD: 8,      // Zoom 8x+ shows weeks
    MONTHLY_THRESHOLD: 3,     // Zoom 3x-8x shows months
    QUARTERLY_THRESHOLD: 1.5  // Zoom 1.5x-3x shows quarters
}
```

You can adjust these values if you want different transition points.

## Notes

- The granularity change is **automatic** and happens during the zoom operation
- The slider position is maintained during zoom operations
- The active events panel continues to update as you move the slider at any zoom level
