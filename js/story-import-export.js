import { TimelineStorage } from './storage.js';
import { CONFIG } from './config.js';
import { ensureDataIds, parseAndPrepareCSV, generateTypeMappings } from './utils.js';

export function initImportExportUI(storage, refreshCallback) {
    // Modal Elements for Download Options
    const downloadModal = document.getElementById('download-options-modal');
    const closeDlBtn = document.getElementById('close-download-options-btn');
    const zipBtn = document.getElementById('download-zip-btn');
    const jsonBtn = document.getElementById('download-json-btn');

    if (closeDlBtn) {
        closeDlBtn.addEventListener('click', () => downloadModal.classList.add('hidden'));
    }

    // Helper: Trigger Download
    const triggerDownload = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = filename.replace(/[^a-z0-9\._-]/gi, '_').toLowerCase();
        a.download = safeName;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Helper: Download JSON
    const downloadJSON = (story, stripLocal = false) => {
        let finalStory = story;
        if (stripLocal) {
            // Deep clone to avoid mutating original
            finalStory = JSON.parse(JSON.stringify(story));
            if (finalStory.data) {
                finalStory.data.forEach(d => {
                    if (d.imageLocalId) delete d.imageLocalId;
                    if (d.imageUrl && d.imageUrl.startsWith('loc_')) delete d.imageUrl;
                });
            }
        }

        const jsonContent = JSON.stringify(finalStory, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        triggerDownload(blob, (story.name || 'story') + '.json');
    };

    // Helper: Download ZIP
    const downloadZIP = async (story) => {
        if (!window.JSZip) {
            alert("JSZip library not loaded. Cannot create ZIP.");
            return;
        }

        const zip = new JSZip();
        // Create images folder
        const imgFolder = zip.folder("images");

        // Create a copy of the story to modify paths
        const storyCopy = JSON.parse(JSON.stringify(story));
        let imgCount = 0;

        // Process images
        if (storyCopy.data) {
            for (let i = 0; i < storyCopy.data.length; i++) {
                const ev = storyCopy.data[i];
                const localId = ev.imageLocalId || (ev.imageUrl && ev.imageUrl.startsWith('loc_') ? ev.imageUrl : null);

                if (localId) {
                    const base64Data = storage.getImage(localId);
                    if (base64Data) {
                        try {
                            // Extract Base64 data (remove prefix like "data:image/png;base64,")
                            const parts = base64Data.split(',');
                            if (parts.length === 2) {
                                const meta = parts[0];
                                const data = parts[1];

                                // Detect extension
                                let ext = 'png';
                                if (meta.includes('jpeg')) ext = 'jpg';
                                if (meta.includes('webp')) ext = 'webp';
                                if (meta.includes('gif')) ext = 'gif';

                                const filename = `${localId}.${ext}`;

                                // Add to ZIP
                                imgFolder.file(filename, data, { base64: true });

                                // Update reference in the JSON to point to the relative path
                                ev.imageUrl = `images/${filename}`;

                                // Remove internal local ID so it relies on the portable path
                                delete ev.imageLocalId;

                                imgCount++;
                            }
                        } catch (e) {
                            console.warn("Failed to add image to zip", localId, e);
                        }
                    }
                }
            }
        }

        // Add the JSON file to the root of the ZIP
        zip.file("story.json", JSON.stringify(storyCopy, null, 2));

        try {
            const content = await zip.generateAsync({ type: "blob" });
            triggerDownload(content, (story.name || 'story') + '.zip');
        } catch (e) {
            console.error("ZIP Generation Error:", e);
            alert("Failed to generate ZIP file.");
        }
    };

    // Main Download Button Handler
    document.getElementById('download-sample').addEventListener('click', () => {
        const activeStory = storage.getActiveStory();
        if (!activeStory) {
            alert("No active story to download.");
            return;
        }

        // Check for local images
        let hasLocalImages = false;
        if (activeStory.data) {
            hasLocalImages = activeStory.data.some(ev => ev.imageLocalId || (ev.imageUrl && ev.imageUrl.startsWith('loc_')));
        }

        if (hasLocalImages) {
            // Setup Modal Actions
            if (zipBtn) {
                zipBtn.onclick = () => {
                    downloadModal.classList.add('hidden');
                    downloadZIP(activeStory);
                };
            }
            if (jsonBtn) {
                jsonBtn.onclick = () => {
                    downloadModal.classList.add('hidden');
                    // Download JSON without local images (strip them)
                    downloadJSON(activeStory, true);
                };
            }

            // Show Modal
            downloadModal.classList.remove('hidden');
        } else {
            // Standard JSON download
            downloadJSON(activeStory);
        }
    });

    // CSV Upload
    const uploadInput = document.getElementById('csv-upload');
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = d3.csvParse(event.target.result);
                    const activeStory = storage.getActiveStory();

                    if (confirm(`Importing CSV. Merge ${data.length} events into the current story "${activeStory ? activeStory.name : 'New Story'}"?`)) {
                        let mergedData = data;
                        if (activeStory && Array.isArray(activeStory.data)) {
                            ensureDataIds(data);
                            mergedData = [...activeStory.data, ...data];

                            storage.saveActiveStory(mergedData);

                            // Merge Settings (Colors/Icons)
                            const currentSettings = activeStory.settings || {};
                            const currentColors = { ...CONFIG.TYPE_COLORS, ...(currentSettings.colors || {}) };
                            const currentIcons = currentSettings.icons || {};

                            const mappings = generateTypeMappings(data, currentColors, currentIcons);

                            storage.updateStorySettings(activeStory.id, {}, {
                                colors: mappings.colors,
                                icons: mappings.icons
                            });
                        } else {
                            const name = `Imported Story ${new Date().toLocaleTimeString()}`;
                            ensureDataIds(data);
                            const mappings = generateTypeMappings(data, CONFIG.TYPE_COLORS, {});
                            storage.createStory(name, data, {
                                settings: { colors: mappings.colors, icons: mappings.icons }
                            });
                        }

                        window.timelineData = mergedData;
                        refreshCallback({ resetView: true });
                    }
                } catch (error) {
                    console.error("Error parsing CSV:", error);
                    alert("Failed to parse CSV.");
                }
            };
            reader.readAsText(file);
        }
    });

    // JSON / ZIP Upload
    const uploadJsonInput = document.getElementById('json-upload');
    uploadJsonInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset input so it triggers again on same file
        e.target.value = '';

        try {
            if (file.name.endsWith('.zip')) {
                // HANDLE ZIP Import
                if (!window.JSZip) {
                    alert("JSZip library not loaded. Cannot process ZIP file.");
                    return;
                }

                const zip = await JSZip.loadAsync(file);

                // Find JSON file (assume only one, or process 'story.json')
                let jsonFile = zip.file("story.json");
                if (!jsonFile) {
                    // Fallback: look for any .json file in root
                    const files = Object.keys(zip.files);
                    const jsonPath = files.find(f => f.endsWith('.json') && !f.includes('/') && !f.startsWith('__'));
                    if (jsonPath) jsonFile = zip.file(jsonPath);
                }

                if (!jsonFile) {
                    throw new Error("No JSON story file found in the archive.");
                }

                const jsonStr = await jsonFile.async("string");
                const story = JSON.parse(jsonStr);

                if (!confirm(`Importing ZIP Archive.\nReplace active story with "${story.name || 'Imported Story'}"?`)) {
                    return;
                }

                // Process Images folder
                const imageFolder = zip.folder("images");
                const imageMap = new Map(); // filename -> new local ID

                if (imageFolder) {
                    const imgFiles = [];
                    imageFolder.forEach((relativePath, fileEntry) => {
                        if (!fileEntry.dir) imgFiles.push(fileEntry);
                    });

                    console.log(`[Import] Found ${imgFiles.length} images in ZIP.`);

                    // Process sequentially to be safe
                    for (const imgFile of imgFiles) {
                        const filename = imgFile.name.split('/').pop(); // Extract filename from path
                        const ext = filename.split('.').pop().toLowerCase();

                        // Determine MIME
                        let mime = 'image/png';
                        if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
                        if (ext === 'webp') mime = 'image/webp';
                        if (ext === 'gif') mime = 'image/gif';
                        if (ext === 'svg') mime = 'image/svg+xml';

                        try {
                            const base64Content = await imgFile.async("base64");
                            const dataUrl = `data:${mime};base64,${base64Content}`;

                            // Save to local storage
                            const newId = storage.saveImage(dataUrl);
                            imageMap.set(filename, newId);
                            // Also map full relative path just in case
                            imageMap.set(imgFile.name, newId);
                        } catch (err) {
                            console.warn("Failed to import image from ZIP:", imgFile.name, err);
                        }
                    }
                }

                // Restore references in Story Data
                if (story.data) {
                    ensureDataIds(story.data);
                    story.data.forEach(ev => {
                        if (ev.imageUrl && !ev.imageUrl.startsWith('http') && !ev.imageUrl.startsWith('data:')) {
                            // Checked if it matches our internal structure (e.g. images/foo.png)
                            const key1 = ev.imageUrl; // 'images/foo.png'
                            const key2 = ev.imageUrl.split('/').pop(); // 'foo.png'

                            if (imageMap.has(key1)) {
                                ev.imageUrl = imageMap.get(key1); // Set to new loc_ ID
                                ev.imageLocalId = ev.imageUrl;
                            } else if (imageMap.has(key2)) {
                                ev.imageUrl = imageMap.get(key2);
                                ev.imageLocalId = ev.imageUrl;
                            }
                        }
                    });
                }

                // Import
                storage.importStory(story);
                window.timelineData = story.data;
                console.log("[Import] ZIP Import successful:", story.name);
                refreshCallback({ resetView: true });

            } else {
                // NORMAL JSON IMPORT
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const story = JSON.parse(event.target.result);
                        if (story && Array.isArray(story.data)) {
                            if (confirm(`Replace active story with "${story.name || 'Uploaded Story'}"?`)) {
                                ensureDataIds(story.data);
                                storage.importStory(story);
                                window.timelineData = story.data;
                                console.log("Story imported:", story.name);
                                refreshCallback({ resetView: true });
                            }
                        } else {
                            alert("Invalid Story JSON format.");
                        }
                    } catch (err) {
                        console.error("Error parsing JSON:", err);
                        alert("Failed to parse JSON file.");
                    }
                };
                reader.readAsText(file);
            }
        } catch (err) {
            console.error("Import Failed:", err);
            alert("Failed to import file: " + err.message);
        }
    });
}
