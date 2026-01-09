# TODO

- [x] start new Story
- [X] configure colors for categories
- [X} drill down / zoom in on a specific category
- [X] paste CSV data (e.g. in new story)
- [X] upload CVS => merge into story (not replace)
- [x] show all locations on map under slider
- [ ] configure map style
- [X] allow user to select one of several stories from local storage
- [X} configure icons for event types and use the in addition to toppled triangle (default icon)
* [x]define icons for event types (battle, birth, death, treaty, ..) 
* [x] define colors for event types for periods 
* [x] allow custom event types
* [X] add image to event ( enter image URL) and show image in tooltip
* [X] add image to event (paste image,  upload file)
* [X] search / filter on text
* [X] collapse / expand per L0 (context menu on L0 label)
* [X] change bar into icon when bar is too small in current zoom scale
* [X] icons for release (rocket launch), hospital
* [X] load one of preshipped stories (from data folder)
* [ ] save only visible part of story 
* [ ] paste Google Maps location on map
* [X] search from date to date
* [X] zoom after search - to only show L0 items and L1 with a found event, only show time section for the found events
* [X] show icons on map (in color) instead of default markers
* [X] allow color and icon for event (in edit event)
* [ ] remove file when file reference is updated or event is removed (from local storage)
* [ ] remove files when story is removed
* [X] check for dangling files: no event references the file; then remove the file
* [X] show image in map tooltip for local file
* [X] process url param at startup to load shipped story
* [X] process url param at startup to retrieve a timeline story file from a URL 
* [X] add light theme?
* [ ] process url param at startup to retrieve a timeline story file from a URL at a Microsoft EntraId protected location (first login, then retrieve file)
* [X] do not reserve vertical space for a bar if there is no bar to be displayed
* [X] do not reserve vertical space for icons if there no icons  to be displayed
* [ ] full export of story, including local image files
* [ ] full import of story, including image files to be stored locally
* [X] show parent context (L0.title voor L1, L0.title >L1.title for L2) - in tooltip, on events panel (derive in )
* [ ] named locations = allow user to define locations with a name and select these locations for events; show name in tooltip on map and perhaps as label on the map?
* [X] stop with point events and remove special code section for triangles function drawEventTriangles 
* [X] show label on map 
* [ ] nested bars: L1 bars within L0 bars; L2 bars within L1 bars
* [X] provide search field with map in Edit Event dialog; retrieve and list locations (from OpenStreetMap geocoding api); allow user to select a location 
* [X] map panel: configure label shown for pinpoints: what elements should the location label contain? (locationName, start/end-date, event name, content titles from L0 and L1)