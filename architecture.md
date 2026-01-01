# System Architecture

## Overview

The Company Timeline Visualization is a client-side, single-page application (SPA) designed to visualize strategic roadmaps and events. It parses CSV data locally and renders an interactive timeline using **D3.js**. The application emphasizes modularity, using ES6 modules to separate concerns between data processing, rendering, and interaction logic.

## Technology Stack

- **Core**: HTML5, CSS3, JavaScript (ES6+).
- **Visualization Engine**: [D3.js v7](https://d3js.org/) (Data-Driven Documents).
- **Styling**: Vanilla CSS using CSS Custom Properties (Variables) for theming.
- **Fonts**: Google Fonts ("Outfit").
- **External Dependencies**: 
  - D3.js (Visualization)
  - Leaflet.js (Maps)
  - OpenStreetMap (Tiles)

## Project Structure

```
├── index.html           # Application Entry Point
├── css/
│   └── style.css        # Global styles and visualization theme
├── js/
│   ├── main.js          # Application Orchestrator
│   ├── layout-engine.js # Data Processing & Layout Logic
│   ├── renderer.js      # D3 Visualization & Interaction
│   ├── config.js        # Configuration Constants
│   └── utils.js         # Shared Utilities
└── sample.csv           # Default dataset
```

## Key Components

### 1. Application Orchestrator (`main.js`)
- **Responsibility**: Initializes the application, manages UI event listeners (upload, zoom), and coordinates data flow.
- **Key Interactions**:
  - Listens for DOMContentLoaded.
  - Instantiates `TimelineRenderer`.
  - Handles CSV file uploads and loading of sample data.
  - Updates the Side Panel based on the renderer's slider state.
  - **Map Controller**: Manages the Leaflet instance, markers, and resizing logic.
  - **Tab Switching**: Toggles between "Events" list and "Map" view.

### 2. Layout Engine (`layout-engine.js`)
- **Responsibility**: transform raw CSV data into a structured, visualizable layout.
- **Logic Flow**:
  1. **Data Normalization**: Parses date strings into Date objects. Detects **Point Events** (records with no end date).
  2. **Grouping**: Groups items by `level0` (e.g., Department).
  3. **Classification**: Separates `Timeline Items` (Bars) from `Point Events` (Triangles).
  4. **Row Packing**: Uses a greedy algorithm to assign timeline items to vertical rows within their group to prevent overlap.
  5. **Output**: Returns a hierarchical object structure containing coordinate metadata for the renderer.

### 3. Timeline Renderer (`renderer.js`)
- **Responsibility**: Manages the D3 SVG canvas and handles all visual drawing and direct manipulation.
- **Key Features**:
  - **Drawing**: Renders Axes (Year/Quarter/Month/Week), Group Backgrounds, Timeline Bars, and Event Triangles.
  - **Zooming**: Implements a semantic zoom that changes axis granularity based on the zoom factor.
  - **Interactive Slider**: Manages the draggable vertical line. Calculates which events are "active" at the slider's position.
  - **Tooltips**: Handles mouseover events to show detailed metadata. Includes logic to "lock" interactive tooltips to allow traversing bars.
  - **Highlighting**: Exposes API to highlight events based on external triggers (e.g., map hover).

### 4. Utilities & Config (`utils.js`, `config.js`)
- **Utils**: Contains robust Date parsing logic (ISO 8601, European formats) and tooltip management.
- **Config**: Centralized source of truth for visual constants (Colors, Padding, Bar Heights) and Zoom behavior thresholds.

## Data Flow

1. **Input**: User uploads a CSV file or loads the sample.
2. **Parsing**: `d3.csvParse` converts the text into an array of objects.
3. **Processing**: `layout-engine.js` processes the array:
    - Dates are parsed (`YYYY-MM`, `YYYY-MM-DD`, etc).
    - Events are flagged.
    - Items are grouped and assigned Y-coordinates (rows).
4. **Rendering**: `renderer.js` receives the layout object.
    - Calculates absolute pixel positions based on the current Time Scale and Zoom level.
    - Draws SVG elements to the DOM.
5. **Interaction**:
    - **Zoom**: Updates the Scale domain and re-draws elements.
    - **Slider**: Checks `startDate <= sliderDate <= endDate` and highlights active items.
    - **Map Sync**: Hovering timeline `->` `main.js` adds pin. Hovering pin `->` `renderer.js` highlights bar.

## Critical Algorithms

### Layout Packing (Row Assignment)
To ensure compact visualization without overlapping bars, the Layout Engine uses a simple packing algorithm for each Group:
1. Sort items by Start Date.
2. Maintain a list of "Row End Dates".
3. For each item, place it in the first row where `Item.Start > Row.End`.
4. If no fitting row is found, create a new row.

### Semantic Zoom
The `renderer.js` adjusts the X-Axis ticks and labels based on the `zoomFactor`:
- `> 8x`: Weekly Ticks
- `> 3x`: Monthly Ticks
- `> 1.5x`: Quarterly Ticks
- `Default`: Yearly Ticks
