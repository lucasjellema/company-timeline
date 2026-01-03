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
│   ├── style.css        # Global styles and visualization theme
│   ├── resizing.css     # Utility styles for split-view resizing state
│   └── search.css       # Styles for search and filter elements
├── js/
│   ├── main.js          # Application Orchestrator
│   ├── layout-engine.js # Data Processing & Layout Logic
│   ├── renderer.js      # D3 Visualization Coordinator
│   ├── renderer-axis.js # Axis & Grid Rendering
│   ├── renderer-events.js # Event & Timeline Item Rendering
│   ├── renderer-interaction.js # Zoom, Pan, & Interaction Logic
│   ├── config.js        # Configuration Constants
│   ├── utils.js         # Shared Utilities
│   ├── storage.js       # Local Storage Management
│   ├── story-ui.js      # Story Management UI Logic (Load/Save/Switch)
│   ├── story-settings.js # Story Metadata & Settings
│   ├── event-editor.js  # Add/Edit Event Logic
│   ├── map-manager.js   # Leaflet Map Controller
│   ├── search-controller.js # Search & Filter Logic
│   └── ui-controls.js   # General UI Event Handlers
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
  - **Map Controller**: Manages the Leaflet instance and synchronizes markers with the slider's active events.
  - **Splitter Controller**: Manages the resizable split-view layout. Uses a throttled `requestAnimationFrame` loop to notify the `TimelineRenderer` of size changes, ensuring smooth 60fps responsive scaling.
  - **Tab Switching**: Toggles between "Events" list and "Map" view.
  - **Drill Down State**: Manages the `activeL0Category` state. Filters the raw dataset dynamically before passing it to the Layout Engine when a category is selected.

### 2. Layout Engine (`layout-engine.js`)
- **Responsibility**: transform raw CSV data into a structured, visualizable layout.
- **Logic Flow**:
  1. **Data Normalization**: Parses date strings into Date objects. Detects **Point Events** (records with no end date).
  2. **Grouping**: Groups items by `level0` (e.g., Department).
  3. **Classification**: Separates `Timeline Items` (Bars) from `Point Events` (Triangles).
  4. **Row Packing**: Uses a greedy algorithm to assign timeline items to vertical rows within their group to prevent overlap.
  5. **Output**: Returns a hierarchical object structure containing coordinate metadata for the renderer.

### 3. Timeline Renderer (`renderer.js`)
- **Responsibility**: Coordinates the rendering process, delegating specific tasks to specialized sub-modules to maintain clean separation of concerns.
- **Sub-Modules**:
  - **`renderer-axis.js`**: Handles drawing of the time axis, grid lines, and tick formatting based on zoom level.
  - **`renderer-events.js`**: Manages the drawing of timeline bars, event triangles, and their visual styling.
  - **`renderer-interaction.js`**: Handles user interactions like zooming, panning, and event hovering.
- **Key Features**:
  - **Drawing**: Renders Axes (Year/Quarter/Month/Week), Group Backgrounds, Timeline Bars, and Event Triangles via sub-modules.
  - **Zooming**: Implements a semantic zoom that changes axis granularity based on the zoom factor.
  - **Interactive Slider**: Manages the draggable vertical line with multiple interaction handles (top, bottom, and distributed). Calculates which events (duration bars and point milestones) are "active" at the slider's position.
  - **Tooltips**: Handles mouseover events to show detailed metadata. Includes logic to "lock" interactive tooltips to allow traversing bars.
  - **Highlighting**: Exposes API to highlight events based on external triggers (e.g., map hover).
  - **Drill Down Interaction**: Detects double-clicks on category headers to trigger filtering. Renders visual controls (Back button) when in a filtered state.

### 4. Application Logic Modules
- **`storage.js`**: Abstraction layer for `localStorage`. Handles saving, loading, listing, and deleting stories. Includes logic to merge new events into existing stories.
- **`story-ui.js`**: Manages the "Load Story" and "Create Story" modals. Handles the "Shipped Stories" feature (loading pre-packaged JSONs).
- **`event-editor.js`**: Controls the "Add Event" modal form. Handles input validation, date range copying, and location selection via mini-map.
- **`search-controller.js`**: Manages the Search tab in the side panel. Implements filtering by keyword, event type, and duration. Updates the renderer to highlight matching events.
- **`map-manager.js`**: Dedicated controller for the Leaflet map instance, handling marker creation, synchronization with the time slider, and popup management.

### 5. Utilities & Config (`utils.js`, `config.js`)
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
    - **Map Sync**: Slider Drag -> `main.js` updates Map pins. Hovering pin -> `renderer.js` highlights bar.

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
