# 📊 Company Timeline Visualization

A premium, interactive company timeline visualization tool powered by **D3.js**. Designed to provide a clear, hierarchical view of strategic roadmaps, project deliveries, and operational milestones across multiple organizational levels.

![Preview Placeholder](https://via.placeholder.com/800x400.png?text=Company+Timeline+Visualization+Preview)

## ✨ Features

- **Interactive D3.js Engine**: Smooth pan and zoom capabilities for exploring long-term roadmaps or specific sprint details.
- **Adaptive Zoom Granularity**: Timeline automatically adjusts detail level when zooming:
  - **Years** - Base level (1x - 1.5x zoom)
  - **Quarters** - Low-medium zoom (1.5x - 3x zoom)
  - **Months** - Medium zoom (3x - 8x zoom)
  - **Weeks** - High detail zoom (8x+ zoom)
- **Geographic Map Integration**:
  - **Dual Mode**: View event details in a dedicated side panel tab or via rich tooltips.
  - **Interactive Map**: Built with **Leaflet.js**, displaying events with geolocation data (`lattitude`, `longitude`).
  - **Pins vs Icons**: Toggle between standard map pins and **custom event icons**. Icons are color-coded based on the event's type or specific color override.
  - **Slider Sync**: The map automatically updates in real-time to show pins for all events (including milestones) active at the slider's current time.
  - **Hover Sync**: Hovering over map pins highlights the corresponding timeline events for easy identification.
- **Hierarchical Layout**: Automatically groups events by organizational levels (Level 0, Level 1, Level 2).
- **Vertical Time Slider**: A draggable time focus that highlights active events at any specific point in time. Includes multiple drag handles (top, bottom, and periodically along the line) for easy interaction on tall timelines.
- **Real-time Side Panel**: Instantly see all "Simultaneous Events" occurring at the selected slider date.
- **Dynamic Styling**: Color-coded event types (Projects, Releases, Sprints, Training) for quick visual scanning.
- **CSV Integration**: Upload CSV files or **paste CSV text directly** to create new stories or append to existing ones.
- **Event Gallery**: A dedicated side panel tab that creates a visual grid of event images. Automatically filters to show images for active events (under the slider) or search results.
- **Responsive Design**: Adapts to various screen sizes with automatic re-rendering.
- **Theme Toggle**: Switch effortlessly between **Dark Mode** (default) and **Light Mode) to suit your viewing preference. Theme preference is automatically saved.
- **Strategic Drill Down**: 
  - **Category Focus**: Double-click any top-level category (Level 0) header to filter the timeline to that specific department.
  - **Event Focus**: Double-click any **event** to enter "Extreme Focus" mode. This zooms the timeline to the event's duration and collapses all other groups to minimize noise.
- **Resizable Interface**: Interactive splitter allows users to seamlessly resize the side panel. The timeline visualization automatically adjusts its scale and layout to fill the remaining space in real-time.
- **Story Management**: Create new stories from scratch, switch between multiple saved stories, or load pre-packaged "Shipped Stories" (e.g., WWII, Tech History). Supports direct loading via URL parameters (`shipped_story` and `story_file_url`).
- **Rich Event Editor**: Comprehensive modal for adding events with support for:
  - Custom Event Types (with specific colors/icons)
  - Date Ranges (with quick "Copy Start to End" utility)
  - **Image Support**: Add image URLs to events for rich previews in tooltips and map popups.
  - Interactive Mini-map for location picking
- **Advanced Search & Filtering**: Filter events by keyword, type, or duration. The timeline semantic zoom automatically adjusts to show the context of search results.
- **Context Menus**: Right-click on events to Edit, Delete, or Move them. Right-click on the Story list to Clone or Delete stories.


## 🚀 Getting Started

### Prerequisites

You will need a local web server to run the application because it uses ES6 modules.

### Installation

1. Clone or download this repository.
2. Open a terminal in the project directory.
3. Start a local server. For example, using Python or Node.js:

   **Node.js (Recommended):**
   ```bash
   npx http-server .
   ```

   **Python:**
   ```bash
   python -m http.server 8000
   ```

4. Open your browser and navigate to `http://localhost:8080` (or the port provided by your server).

## 📅 Data Format

The visualization consumes CSV data with the following structure:

| Column | Description |
| :--- | :--- |
| `start` | The start date (YYYY-MM, YYYY-MM-DD, or DD-MM-YYYY) |
| `end` | The end date (same formats as start) - **Leave empty for point events** |
| `title` | The name of the event or project |
| `description` | Detailed information about the event (shown in tooltips) |
| `type` | The category of event (e.g., `project`, `release`, `sprint`, `training`) |
| `level0` | Top-level grouping (e.g., Department or Division, Program) |
| `level1` | Second-level grouping (e.g., Team or Platform, Project) |
| `level2` | Third-level grouping (e.g., Project category or Module) |
| `lattitude` | (Optional) Latitude for map visualization |
| `longitude` | (Optional) Longitude for map visualization |
| `imageUrl` | (Optional) URL to an image representing the event |

### Date Formats

The timeline supports flexible date formats:
- **Month precision**: `YYYY-MM` (e.g., `2023-06`)
- **Day precision (ISO)**: `YYYY-MM-DD` (e.g., `2023-06-15`)
- **Day precision (European)**: `DD-MM-YYYY` (e.g., `15-06-2023`)

### Events vs Timeline Items

- **Timeline Items**: Have both start and end dates, displayed as horizontal bars
- **Events**: Have only a start date (leave `end` column empty), displayed as **downward-pointing triangles** at the top of their group

### Sample CSV Snippet
```csv
start,end,title,description,type,level0,level1,level2
2023-01,2023-06,Cloud Migration,Moving data centers to AWS,project,IT,infrastructure,cloud
2023-03,2023-05,Q1 Release,Core platform stabilization,release,company,platform,core
2023-09-15,,Product Launch,Official launch event,release,company,product,launch
17-03-2025,,Major Milestone,Company anniversary celebration,project,company,growth,milestone
```

## 🛠️ Built With

- **[D3.js](https://d3js.org/)** - Data-driven document manipulation.
- **[Leaflet.js](https://leafletjs.com/)** - Interactive maps.
- **Vanilla JavaScript (ES6+)** - Modular application logic.
- **Vanilla CSS3** - Modern styling with CSS Grid and HSL color systems.
- **Google Fonts** - Featuring the "Outfit" typography.

## 📁 Project Structure

- `index.html` - The main entry point and UI layout.
- `css/style.css` - Custom styles and design system.
- `js/`
  - `main.js` - Application orchestration and event handling.
  - `renderer.js` - D3 visualization coordinator.
  - `renderer-axis.js` - Timeline axis rendering.
  - `renderer-events.js` - Event bars and point drawing logic.
  - `renderer-interaction.js` - User interaction handling (zoom, click, hover).
  - `gallery-manager.js` - Logic for the side panel image gallery.
  - `layout-engine.js` - Data processing and hierarchical layout calculations.
  - `config.js` - Centralized configuration and constants.
  - `utils.js` - Helper functions.
- `sample.csv` - Demonstration data file.

---

*Crafted with ❤️ for organizational transparency.*
