import { TimelineStorage } from './storage.js';
import { CONFIG } from './config.js';
import { ensureDataIds } from './utils.js';
import * as auth from './auth.js';
import { Client } from "https://cdn.jsdelivr.net/npm/@microsoft/microsoft-graph-client@3.0.4/+esm";

export function initShippedStoriesUI(storage, refreshCallback) {
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
