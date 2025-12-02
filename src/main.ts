import '../css/familienbaum.css';
import * as d3 from 'd3';
import { loadFromGoogleSheet } from './services/data/sheetLoader';
import { Familienbaum } from './components/Tree/Familienbaum';
import { initEditor } from './ui/editor/index';
import { initDarkMode } from './utils/darkMode';
import { FamilyData } from './types/types';
import { filterPatrilineal } from './utils/patrilinealFilter';
import { buildIdMaps, decodeState, updateURL, shareCurrentState } from './services/state/urlState';
import { store } from './services/state/store';

// Constants
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzo66Bb8-z3QdqtNGZ9uhQJZJxePifl6nJwvtlot-3JtKp4YKYQdqJNFDY89lqHoMRdlKZmjWzh2OA/pub?output=csv";

// Initialize Dark Mode
initDarkMode();

// Main initialization
async function init() {
    let inputData: FamilyData | null = null;
    try {
        inputData = await loadFromGoogleSheet(GOOGLE_SHEET_CSV_URL);
        localStorage.setItem('soyagaci_cached_data', JSON.stringify(inputData));
    } catch (e) {
        console.warn("Network failed, trying cache...", e);
        const cached = localStorage.getItem('soyagaci_cached_data');
        if (cached) inputData = JSON.parse(cached);
    }

    if (!inputData) {
        alert("Could not load data.");
        return;
    }

    // Initialize Store
    store.setData(inputData);
    buildIdMaps(inputData); // Build maps on full data

    // State restoration
    let urlState = decodeState();
    let patrilinealMode = store.getState().isPatrilineal; // Loaded from localStorage in Store constructor
    let lastNodeId: string | null = null;
    let savedVisibleNodes: Set<string> | null = null;
    let savedTransform: any = null;

    if (urlState) {
        console.log('Loading state from URL');
        patrilinealMode = urlState.patrilineal;
        store.setPatrilineal(patrilinealMode);
        lastNodeId = urlState.currentNode;
        savedVisibleNodes = urlState.visibleNodes;
        savedTransform = urlState.transform;
    } else {
        console.log('Loading state from localStorage');
        // patrilinealMode already set in store constructor from localStorage
        lastNodeId = localStorage.getItem('soyagaci_last_node');

        const savedVisibleNodesJson = localStorage.getItem('soyagaci_visible_nodes');
        if (savedVisibleNodesJson) {
            try {
                savedVisibleNodes = new Set(JSON.parse(savedVisibleNodesJson));
            } catch (e) { console.warn("Failed to restore visible nodes", e); }
        }

        const savedTransformJson = localStorage.getItem('soyagaci_view_transform');
        if (savedTransformJson) {
            try {
                savedTransform = JSON.parse(savedTransformJson);
            } catch (e) { console.warn("Failed to restore transform", e); }
        }
    }

    // Set start node
    if (lastNodeId && inputData.members[lastNodeId]) {
        inputData.start = lastNodeId;
    }

    // UI Elements
    const globalToggle = document.getElementById('patrilineal-global-toggle');
    const toggleIcon = document.getElementById('toggle-icon');
    const toggleText = document.getElementById('toggle-text');
    const svg = d3.select("#tree-container").append("svg").attr("id", "tree-svg");

    // Dimensions
    const updateDimensions = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        svg.attr("width", width).attr("height", height);
    };
    window.addEventListener("resize", updateDimensions);
    updateDimensions();

    let familienbaum: Familienbaum;

    // Render Function
    function renderTree() {
        svg.selectAll("*").remove();

        const currentFullData = store.getState().fullFamilyData!;
        let displayData = currentFullData;

        if (store.getState().isPatrilineal) {
            displayData = filterPatrilineal(currentFullData);
            if (globalToggle && toggleIcon && toggleText) {
                globalToggle.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                toggleIcon.textContent = '👨‍👦‍👦';
                toggleText.textContent = 'Tüm Soy Ağacı';
            }
        } else {
            if (globalToggle && toggleIcon && toggleText) {
                globalToggle.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                toggleIcon.textContent = '👨‍👦';
                toggleText.textContent = 'Sadece Erkek Soyu';
            }
        }

        // Update store with currently displayed data (optional, but good for consistency)
        // store.setData(displayData); // Careful, this might trigger loops if we subscribed to it. 
        // For now, we just use displayData for the tree.

        familienbaum = new Familienbaum(displayData, svg, () => {
            // onViewChange callback
            updateURL(familienbaum, displayData);

            // Sync visible nodes to store (optional, for other UI components)
            if (familienbaum.dag_all) {
                const visible = new Set<string>();
                for (let node of familienbaum.dag_all.nodes()) {
                    if (node.added_data?.is_visible) visible.add(node.data);
                }
                store.setVisibleNodes(visible);
            }
        });

        initEditor(familienbaum);

        // Restore Visible Nodes
        if (savedVisibleNodes && savedVisibleNodes.size > 0) {
            if (familienbaum.dag_all) {
                for (let node of familienbaum.dag_all.nodes()) {
                    if (savedVisibleNodes.has(node.data)) {
                        node.added_data.is_visible = true;
                    }
                }
                // Also mark relationships visible
                for (let node of familienbaum.dag_all.nodes()) {
                    if (savedVisibleNodes.has(node.data)) {
                        const relationships = familienbaum.get_relationship_in_dag_all(node);
                        for (let relNode of relationships) {
                            if (savedVisibleNodes.has(relNode.data) || relNode.data.startsWith('u_')) {
                                relNode.added_data.is_visible = true;
                            }
                        }
                    }
                }
            }
            savedVisibleNodes = null; // Clear after first use
        }

        familienbaum.draw(false);

        // Restore Transform
        if (savedTransform) {
            try {
                const transform = d3.zoomIdentity.translate(savedTransform.x, savedTransform.y).scale(savedTransform.k);
                svg.call(familienbaum.zoom.transform, transform);
            } catch (e) { console.warn("Failed to restore transform", e); }
            savedTransform = null; // Clear after first use
        } else {
            // Initial center
            let current_node = familienbaum.dag!.find_node(displayData.start);
            if (current_node) {
                svg.transition().duration(0).call(
                    familienbaum.zoom.transform,
                    d3.zoomTransform(familienbaum.g.node()!)
                        .translate(current_node.added_data.y0! - current_node.y,
                            current_node.added_data.x0! - current_node.x),
                );
            }
        }
    }

    // Initial Render
    renderTree();

    // Event Listeners
    if (globalToggle) {
        globalToggle.addEventListener('click', () => {
            // Capture current state before switching
            if (familienbaum && familienbaum.g) {
                const t = d3.zoomTransform(familienbaum.g.node()!);
                savedTransform = { k: t.k, x: t.x, y: t.y };

                // Use store for reliable state capture
                savedVisibleNodes = new Set(store.getState().visibleNodes);
                console.log("Captured visible nodes from store:", savedVisibleNodes.size);
            }

            store.setPatrilineal(!store.getState().isPatrilineal);
            renderTree();
        });
    }

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareCurrentState(familienbaum, familienbaum.data));
    }

    const openSheetBtn = document.getElementById('btn-open-sheet');
    if (openSheetBtn) {
        openSheetBtn.addEventListener('click', () => {
            window.open("https://docs.google.com/spreadsheets/d/12kZlANYbq0w3k8TpDxssVSlWVfbs-qZQ9bAjERci0SM/edit?gid=790197592", "_blank");
        });
    }

    const closeSidebarBtn = document.querySelector('.close-btn');
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('family-sidebar');
            if (sidebar) sidebar.classList.remove('active');
        });
    }

    window.addEventListener('popstate', () => {
        const urlState = decodeState();
        if (urlState && urlState.currentNode && familienbaum.data.members[urlState.currentNode]) {
            familienbaum.click(urlState.currentNode);
            familienbaum.draw(true, urlState.currentNode);
        }
    });

    // Save state on unload
    window.addEventListener("beforeunload", () => {
        if (familienbaum && familienbaum.g) {
            const transform = d3.zoomTransform(familienbaum.g.node()!);
            localStorage.setItem('soyagaci_view_transform', JSON.stringify({ k: transform.k, x: transform.x, y: transform.y }));

            if (familienbaum.dag_all) {
                const visibleNodes: string[] = [];
                for (let node of familienbaum.dag_all.nodes()) {
                    if (node.added_data?.is_visible) visibleNodes.push(node.data);
                }
                localStorage.setItem('soyagaci_visible_nodes', JSON.stringify(visibleNodes));
            }
        }
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Shift') document.body.classList.add('show-plus'); });
    document.addEventListener('keyup', (e) => { if (e.key === 'Shift') document.body.classList.remove('show-plus'); });
}

init();
