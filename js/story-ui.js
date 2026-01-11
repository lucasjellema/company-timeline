import { TimelineStorage } from './storage.js';
import { initSettingsUI } from './story-settings.js';
import { CONFIG } from './config.js';
import { ensureDataIds, parseAndPrepareCSV, generateTypeMappings } from './utils.js';
import * as auth from './auth.js';
import { Client } from "https://cdn.jsdelivr.net/npm/@microsoft/microsoft-graph-client@3.0.4/+esm";

export function initStoryUI(storage, refreshCallback) {
    initCreateStoryUI(storage, refreshCallback);
    initLoadStoryUI(storage, refreshCallback);
    initSettingsUI(storage, refreshCallback);
    initImportExportUI(storage, refreshCallback);
    initShippedStoriesUI(storage, refreshCallback);
}

function initShippedStoriesUI(storage, refreshCallback) {
    const modal = document.getElementById('shipped-stories-modal');
    const closeBtn = document.getElementById('close-shipped-modal-btn');
    const listContainer = document.getElementById('shipped-story-list');
    const browseBtn = document.getElementById('browse-shipped-btn');
    const loadModal = document.getElementById('load-story-modal');

    // Open from Load Modal
    if (browseBtn) {
        browseBtn.addEventListener('click', () => {
            loadModal.classList.add('hidden');
            modal.classList.remove('hidden');
            renderShippedList();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    // Close on overlay click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    const renderShippedList = () => {
        const stories = CONFIG.SHIPPED_STORIES || [];
        if (stories.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No shipped stories found.</div>';
            return;
        }

        listContainer.innerHTML = stories.map((s, idx) => `
            <li class="story-item" data-idx="${idx}">
                <div class="story-info">
                    <div class="story-title">${s.name}</div>
                    <div class="story-desc">${s.description || ''}</div>
                </div>
                <button class="btn btn-sm btn-primary import-btn" data-idx="${idx}">Import</button>
            </li>
        `).join('');

        listContainer.querySelectorAll('.import-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                importAndLoad(stories[e.target.dataset.idx]);
            });
        });

        listContainer.querySelectorAll('.story-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                importAndLoad(stories[item.dataset.idx]);
            });
        });
    };

    const importAndLoad = (storyConfig) => {
        loadShippedStory(storyConfig, storage, (opts) => {
            refreshCallback(opts);
            modal.classList.add('hidden');
        });
    };
}

export async function loadStoryFromURL(url, storage, completionCallback, meta = {}) {
    try {
        let fetchUrl = url;

        // Auto-convert GitHub Blob URLs to Raw URLs to avoid CORS
        // From: https://github.com/user/repo/blob/main/path/to/file.json
        // To:   https://raw.githubusercontent.com/user/repo/main/path/to/file.json
        if (url.includes('github.com') && url.includes('/blob/')) {
            fetchUrl = url.replace('github.com', 'raw.githubusercontent.com')
                .replace('/blob/', '/');
            console.log(`Converted GitHub URL to Raw: ${fetchUrl}`);
        }

        // OneDrive Workaround
        // Convert Share URL to Graph API endpoint to get direct download URL
        if (url.includes('onedrive.live.com') || url.includes('1drv.ms') || url.includes('sharepoint.com')) {
            try {
                const encodedUrl = btoa(url).replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
                const graphApiUrl = `https://graph.microsoft.com/v1.0/shares/u!${encodedUrl}/driveItem`;

                console.log(`Fetching OneDrive metadata from: ${graphApiUrl}`);

                // Get token using our new auth helper
                const token = await auth.getAccessToken();
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                    console.log("Using authenticated session for OneDrive fetch");
                } else {
                    console.log("Attempting unauthenticated OneDrive fetch");
                }

                // GRAPH CLIENT

                const graphClient = Client.init({
                    authProvider: done => done(null, token)
                });


                function toBase64Url(str) {
                    // base64url (no padding, + → -, / → _)
                    return btoa(unescape(encodeURIComponent(str)))
                        .replace(/=/g, "")
                        .replace(/\+/g, "-")
                        .replace(/\//g, "_");
                }


                const sharingUrl = 'https://conclusionfutureit-my.sharepoint.com/:u:/g/personal/lucas_jellema_amis_nl/IQCOLEe0OjYKRJ2DraB0NNUWAVzXOL_ke1FES2H9WBVuNPk?e=aENb87';
                const shareId = 'u!' + toBase64Url(sharingUrl);

                const apiUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;
                // Use your access token to call this endpoint
                const response = await graphClient.api(apiUrl).get();
                console.log(response);

                //The response will contain both id (itemId) and parentReference.driveId (driveId).





                const resp = await graphClient.api("/me/drive/items/{item id}}/content").get();
                console.log("Got OneDrive download URL via Graph Client");
                fetchUrl = resp['@microsoft.graph.downloadUrl'] || fetchUrl;

                const metaRes = await fetch(graphApiUrl, { headers });

                if (!metaRes.ok) {
                    if (metaRes.status === 401 && !token) {
                        throw new Error("Authentication required for this shared item. Please sign in.");
                    }
                    throw new Error(`Failed to fetch OneDrive metadata: ${metaRes.statusText}`);
                }

                const metaData = await metaRes.json();
                if (metaData['@microsoft.graph.downloadUrl']) {
                    fetchUrl = metaData['@microsoft.graph.downloadUrl'];
                    console.log("Got OneDrive download URL");
                } else {
                    throw new Error("OneDrive metadata did not contain download URL");
                }
            } catch (odErr) {
                console.warn("OneDrive workaround failed, falling back to original URL", odErr);
                // Fallback to original URL if logic fails, though likely to fail CORS too
                if (odErr.message.includes("Authentication required")) {
                    alert(odErr.message);
                }
            }
        }

        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Failed to load ${url}`);
        let data = await res.json();

        // Handle wrapper if present (e.g. if file is { story: { ... } } or just { ... })
        // Assuming the file IS the story object or an array of events.

        let storyObj;

        if (Array.isArray(data)) {
            // Raw Events Array
            ensureDataIds(data);
            storyObj = {
                name: meta.name || "Imported Story",
                description: meta.description || `Loaded from ${url}`,
                data: data
            };
            // Allow storage to create
            storage.createStory(storyObj.name, storyObj.data, { description: storyObj.description });
        } else {
            // Full Story Object
            storyObj = data;
            // Force new ID to treat as template import
            storyObj.id = null;
            // Ensure name/desc if missing
            if (!storyObj.name) storyObj.name = meta.name || "Imported Story";
            if (!storyObj.description) storyObj.description = meta.description || "";

            if (storyObj.data) ensureDataIds(storyObj.data);

            storage.importStory(storyObj);
        }

        // Activate
        const activeStory = storage.getActiveStory();
        window.timelineData = activeStory.data;

        if (completionCallback) {
            completionCallback({ resetView: true });
        }

    } catch (err) {
        console.error(err);
        alert("Failed to load story: " + err.message);
    }
}

export function loadShippedStory(storyConfig, storage, completionCallback) {
    loadStoryFromURL(`data/${storyConfig.file}`, storage, completionCallback, {
        name: storyConfig.name,
        description: storyConfig.description
    });
}

function initCreateStoryUI(storage, refreshCallback) {
    const modal = document.getElementById('create-story-modal');
    const openBtn = document.getElementById('create-story-btn');
    const closeBtn = document.getElementById('close-story-modal-btn');
    const cancelBtn = document.getElementById('cancel-story-btn');
    const form = document.getElementById('create-story-form');

    const openModal = () => {
        modal.classList.remove('hidden');
        const now = new Date();
        if (!document.getElementById('story-start').value) {
            document.getElementById('story-start').value = now.getFullYear();
            document.getElementById('story-end').value = now.getFullYear() + 1;
        }
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        form.reset();
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('story-title-input').value;
        const start = document.getElementById('story-start').value;
        const end = document.getElementById('story-end').value;
        const desc = document.getElementById('story-desc').value;

        const csvPaste = document.getElementById('story-csv-paste').value;
        let initialData = [];

        if (csvPaste && csvPaste.trim()) {
            try {
                initialData = parseAndPrepareCSV(csvPaste);
                console.log(`Parsed ${initialData.length} events from pasted CSV`);
            } catch (err) {
                alert(err.message);
                return; // Stop creation if CSV is invalid
            }
        }

        const mappings = generateTypeMappings(initialData, CONFIG.TYPE_COLORS, {});

        storage.createStory(title, initialData, {
            description: desc,
            start,
            end,
            settings: { colors: mappings.colors, icons: mappings.icons }
        });
        window.timelineData = initialData;

        refreshCallback({ resetView: true });
        closeModal();
    });
}

function initLoadStoryUI(storage, refreshCallback) {
    const modal = document.getElementById('load-story-modal');
    const openBtn = document.getElementById('load-story-btn');
    const closeBtn = document.getElementById('close-load-modal-btn');
    const listContainer = document.getElementById('story-list-container');
    const ctxMenu = document.getElementById('story-context-menu');
    let ctxStoryId = null;

    // Context Menu Logic
    const handleGlobalClick = () => {
        if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
            ctxMenu.classList.add('hidden');
        }
    };
    document.addEventListener('click', handleGlobalClick);

    const bindContextMenuActions = () => {
        const btnClone = document.getElementById('ctx-story-clone');
        const btnDelete = document.getElementById('ctx-story-delete');

        if (btnClone) {
            // Use cloneNode to clear previous listeners if called multiple times, though execute once here is fine
            // Simple onclick assignment is safer if running once.
            btnClone.onclick = (e) => {
                e.stopPropagation();
                ctxMenu.classList.add('hidden');
                if (ctxStoryId) {
                    storage.cloneStory(ctxStoryId);
                    renderStoryList();
                }
            };
        }

        if (btnDelete) {
            btnDelete.onclick = (e) => {
                e.stopPropagation();
                ctxMenu.classList.add('hidden');
                if (ctxStoryId) {
                    if (confirm("Are you sure you want to delete this story? This cannot be undone.")) {
                        const wasActive = storage.getActiveStory()?.id === ctxStoryId;
                        storage.deleteStory(ctxStoryId);
                        renderStoryList();

                        if (wasActive) {
                            // If deleted the currently active story, we might want to reset the view
                            // effectively clearing the timeline or loading a default.
                            // For now, we'll let the user choose another story.
                            // But we should probably signal the main app that the data is gone?
                            // Refreshing with empty or default data might be safer.
                            // We can create a default empty story?
                            // const newStory = storage.createStory("New Story", []);
                            // window.timelineData = newStory.data;
                            // refreshCallback({ resetView: true });
                            // The user is in the load dialog, so they will likely pick another one.
                        }
                    }
                }
            };
        }
    };
    bindContextMenuActions();

    const openModal = () => {
        modal.classList.remove('hidden');
        renderStoryList();
    };

    const closeModal = () => modal.classList.add('hidden');

    const renderStoryList = () => {
        const stories = storage.getStories();
        stories.sort((a, b) => b.lastModified - a.lastModified);

        if (stories.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No saved stories found. Create one!</div>';
            return;
        }

        const activeStory = storage.getActiveStory();
        const activeId = activeStory ? activeStory.id : null;

        listContainer.innerHTML = stories.map(s => {
            const dateStr = new Date(s.lastModified).toLocaleString();
            const activeClass = (s.id === activeId) ? 'active-story-item' : '';
            return `
                <li class="story-item ${activeClass}" data-id="${s.id}">
                    <div class="story-info">
                        <div class="story-title">${s.name}</div>
                        <div class="story-desc">${s.description || 'No description'}</div>
                        <div class="story-meta">Last modified: ${dateStr} &middot; ${s.eventCount} events</div>
                    </div>
                    <button class="btn btn-sm btn-primary load-btn" data-id="${s.id}">Load</button>
                    ${s.id === activeId ? '<span class="badge">Active</span>' : ''}
                </li>
            `;
        }).join('');

        // Bind Events
        listContainer.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadStory(e.target.dataset.id);
            });
        });

        listContainer.querySelectorAll('.story-item').forEach(item => {
            // Load on click
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                loadStory(item.dataset.id);
            });

            // Context Menu on Right Click
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                ctxStoryId = item.dataset.id;

                // Position menu
                ctxMenu.style.left = `${e.pageX}px`;
                ctxMenu.style.top = `${e.pageY}px`;
                ctxMenu.classList.remove('hidden');
            });
        });
    };

    const loadStory = (id) => {
        const story = storage.setActiveStory(id);
        if (story) {
            window.timelineData = story.data;
            refreshCallback({ resetView: true });
            closeModal();
        }
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

function initImportExportUI(storage, refreshCallback) {
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
