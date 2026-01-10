/**
 * Component Loader
 * Fetches HTML fragments and injects them into the DOM, then starts the main app.
 */
async function loadFragment(elementId, url) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Target element #${elementId} not found.`);
        return;
    }

    // Cache busting
    const urlWithTs = `${url}?v=${Date.now()}`;

    try {
        const response = await fetch(urlWithTs);
        if (!response.ok) throw new Error(`Failed to load ${urlWithTs}: ${response.statusText}`);
        const html = await response.text();

        console.log(`[Loader] Fetched ${urlWithTs} (${html.length} bytes).`);
        console.log(`[Loader] Last 100 chars of ${url}: ${html.slice(-100).replace(/\n/g, '\\n')}`);

        // Standard injection - replace the placeholder with the content
        // The previous "unwrap" logic with document fragments might have been causing issues 
        // with specific browser parsers or timing.
        // Let's rely on standard outerHTML replacement which is usually robust.

        // However, element.outerHTML = html works but removes the reference 'element'.
        // If we want to inspect it later, it's tricky.
        // Let's use a temp container to parse, then move children.

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const childCount = tempDiv.childNodes.length;
        console.log(`[Loader] Parsed ${childCount} nodes from ${url}.`);

        // Debug: Log element IDs found
        const foundIds = [];
        tempDiv.querySelectorAll('[id]').forEach(node => foundIds.push(node.id));
        console.log(`[Loader] IDs found in ${url}:`, foundIds);

        // Move children to placeholder's parent, BEFORE placeholder
        const parent = element.parentNode;
        while (tempDiv.firstChild) {
            parent.insertBefore(tempDiv.firstChild, element);
        }
        element.remove();

        console.log(`[Loader] Injected content for ${urlWithTs} and removed #${elementId}`);
    } catch (error) {
        console.error(error);
        element.innerHTML = `<div style="color:red; padding:1rem;">Error loading component: ${urlWithTs}</div>`;
    }
}

async function init() {
    console.log("[Loader] Initializing app shell...");

    // Load sequentially to ensure order and easier debugging
    await loadFragment('header-placeholder', 'partials/header.html');
    await loadFragment('main-placeholder', 'partials/layout.html');
    await loadFragment('overlays-placeholder', 'partials/context-menus.html');

    // Load split modals to avoid parser truncation
    await loadFragment('modals-placeholder', 'partials/modals_1.html');
    // Note: modals_2 will be appended to where modals-placeholder WAS, but it's gone.
    // We need to handle sequential append. 
    // Actually, loadFragment removes the placeholder. So we need a new placeholder or just append to body.
    // Let's create a temporary place for modals_2 if needed, or better, just append to body.
    // But loadFragment requires an elementId to replace.
    // Instead of complex logic, I'll just append a div to body for the second part.
    const m2ph = document.createElement('div');
    m2ph.id = 'modals-2-placeholder';
    document.body.appendChild(m2ph);
    await loadFragment('modals-2-placeholder', 'partials/modals_2.html');

    console.log("[Loader] Fragments loaded. Verifying critical elements...");

    // Check specific elements we expect to exist now
    const checkEl = (id) => {
        const el = document.getElementById(id);
        if (el) {
            // console.log(`[Loader] Verified #${id} exists.`); 
        } else {
            console.error(`[Loader] CRITICAL: Element #${id} MISSING after partial injection.`);
        }
    };

    checkEl('story-title'); // from header
    checkEl('add-event-btn'); // from header
    checkEl('app');         // from layout
    checkEl('context-menu'); // from context-menus
    checkEl('load-story-modal'); // from modals_2 (previously missing)

    // Header visibility diagnostic
    const header = document.querySelector('header');
    if (header) {
        console.log(`[Loader] Header stats: offsetHeight=${header.offsetHeight}, display=${getComputedStyle(header).display}, visibility=${getComputedStyle(header).visibility}, bg=${getComputedStyle(header).backgroundColor}`);
        console.log(`[Loader] Header innerHTML length: ${header.innerHTML.length}`);

        // Inspect controls specifically
        const controls = header.querySelector('.controls');
        if (controls) {
            console.log(`[Loader] .controls items count: ${controls.children.length}`);
            // Log IDs of controls to verify parsing
            console.log(`[Loader] .controls children IDs:`, Array.from(controls.children).map(c => c.id || c.tagName));
        } else {
            console.error("[Loader] .controls container MISSING inside header!");
        }
    } else {
        console.error("[Loader] Header element itself is missing (but story-title was found?)");
    }

    console.log("[Loader] Bootstrapping main module...");

    try {
        // Dynamically import the main module and call its mount function
        const module = await import('./main.js');
        if (module.mountApp) {
            await module.mountApp();
            console.log("[Loader] App mounted successfully.");
        } else {
            console.error("[Loader] main.js did not export mountApp");
        }
    } catch (e) {
        console.error("[Loader] Failed to bootstrap application:", e);
    }
}

// Start the sequence
init();
