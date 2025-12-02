import * as d3 from 'd3';
import { FamilyData, Member } from '../../types/types';
import { Familienbaum } from '../../components/Tree/Familienbaum';

// Map between persistent IDs and mem_X IDs
export const persistentIdMap = new Map<string, string>(); // persistentId -> mem_X
export const reverseIdMap = new Map<string, string>();    // mem_X -> persistentId

// Generate persistent ID from member data (human-readable)
function getPersistentId(member: Member): string {
    if (member.persistentId) return member.persistentId;

    // Extract first 3 chars of first name, first 3 of last name, last 2 of birth year
    const firstName = (member.first_name || 'unk').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 3);
    const lastName = (member.last_name || 'unk').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 3);

    // Extract last 2 digits of birth year
    let yearDigits = '00';
    if (member.birth_date) {
        const yearMatch = member.birth_date.match(/\d{4}/);
        if (yearMatch) {
            yearDigits = yearMatch[0].slice(-2);
        }
    }

    member.persistentId = `${firstName}_${lastName}_${yearDigits}`;
    return member.persistentId;
}

export function buildIdMaps(familyData: FamilyData) {
    persistentIdMap.clear();
    reverseIdMap.clear();

    const counts = new Map<string, number>(); // Track duplicates

    for (const memId in familyData.members) {
        const member = familyData.members[memId];
        if (!member.is_spouse || member.first_name) {
            let persistentId = getPersistentId(member);

            // Handle duplicates by appending a counter
            const baseId = persistentId;
            let counter = counts.get(baseId) || 0;
            if (counter > 0) {
                persistentId = `${baseId}_${counter}`;
            }
            counts.set(baseId, counter + 1);

            member.persistentId = persistentId; // Update with deduplicated ID
            persistentIdMap.set(persistentId, memId);
            reverseIdMap.set(memId, persistentId);
        }
    }
}

// Encode state to URL-friendly base64 string
export function encodeState(currentNode: string | null, transform: any, patrilineal: boolean, visibleNodes: Set<string>): string | null {
    const state = {
        n: currentNode ? reverseIdMap.get(currentNode) || null : null,
        t: transform ? { k: transform.k, x: Math.round(transform.x), y: Math.round(transform.y) } : null,
        p: patrilineal ? 1 : 0,
        v: visibleNodes ? Array.from(visibleNodes).map(id => reverseIdMap.get(id)).filter(Boolean) : []
    };

    try {
        const json = JSON.stringify(state);
        return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (e) {
        console.error('Error encoding state:', e);
        return null;
    }
}

// Decode state from URL hash
export function decodeState(): any {
    try {
        const hash = window.location.hash.slice(1);
        if (!hash) return null;

        // Add padding back
        const base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
        const padding = (4 - base64.length % 4) % 4;
        const padded = base64 + '='.repeat(padding);

        const json = atob(padded);
        const state = JSON.parse(json);

        // Validate state structure
        if (!state || typeof state !== 'object') {
            console.warn('Invalid URL state: not an object');
            return null;
        }

        // Convert persistent IDs back to mem_X IDs
        const decoded = {
            currentNode: null as string | null,
            transform: null as { k: number, x: number, y: number } | null,
            patrilineal: false,
            visibleNodes: new Set<string>()
        };

        // Restore current node
        if (state.n && persistentIdMap.has(state.n)) {
            decoded.currentNode = persistentIdMap.get(state.n) || null;
        }

        // Restore transform
        if (state.t && typeof state.t.k === 'number' && typeof state.t.x === 'number' && typeof state.t.y === 'number') {
            decoded.transform = state.t;
        }

        // Restore patrilineal mode
        decoded.patrilineal = state.p === 1;

        // Restore visible nodes
        if (Array.isArray(state.v)) {
            for (const pid of state.v) {
                const memId = persistentIdMap.get(pid);
                if (memId) {
                    decoded.visibleNodes.add(memId);
                }
            }
        }

        console.log('Decoded URL state:', {
            currentNode: decoded.currentNode,
            transform: decoded.transform,
            patrilineal: decoded.patrilineal,
            visibleCount: decoded.visibleNodes.size
        });

        return decoded;
    } catch (e) {
        console.warn('Error decoding state from URL, falling back to localStorage:', e);
        // Clear invalid hash
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        return null;
    }
}

// Update URL hash with current state
export function updateURL(familienbaum: Familienbaum, familyData: FamilyData) {
    if (!familienbaum || !familienbaum.g) return;

    const transform = d3.zoomTransform(familienbaum.g.node()!);
    const visibleNodes = new Set<string>();

    if (familienbaum.dag_all) {
        for (let node of familienbaum.dag_all.nodes()) {
            if (node.added_data && node.added_data.is_visible) {
                visibleNodes.add(node.data);
            }
        }
    }

    const currentNode = familyData ? familyData.start : null;
    const patrilineal = localStorage.getItem('soyagaci_patrilineal_mode') === 'true';

    const encoded = encodeState(currentNode, transform, patrilineal, visibleNodes);
    if (encoded) {
        history.replaceState(null, '', '#' + encoded);
    }
}

// Share functionality with TinyURL
export async function shareCurrentState(familienbaum: Familienbaum, familyData: FamilyData) {
    const shareBtn = document.getElementById('share-btn');
    if (!shareBtn) return;
    const originalContent = shareBtn.innerHTML;

    try {
        // Update URL first to ensure it's current
        updateURL(familienbaum, familyData);

        const fullURL = window.location.href;

        // Show loading state
        shareBtn.innerHTML = '<span style="font-size: 1.2em;">⏳</span><span>Kısaltılıyor...</span>';
        (shareBtn as HTMLButtonElement).disabled = true;

        // Try TinyURL API (Old API, Deprecated but working without CORS)
        const shortenerApi = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(fullURL)}`;
        const response = await fetch(shortenerApi);

        if (!response.ok) throw new Error('TinyURL failed');

        const shortURL = await response.text();

        // Copy to clipboard
        await navigator.clipboard.writeText(shortURL);

        // Show success
        shareBtn.innerHTML = '<span style="font-size: 1.2em;">✅</span><span>Kopyalandı!</span>';
        setTimeout(() => {
            shareBtn.innerHTML = originalContent;
            (shareBtn as HTMLButtonElement).disabled = false;
        }, 2000);

    } catch (error) {
        console.warn('TinyURL failed, copying full URL:', error);

        try {
            // Fallback: copy full URL
            await navigator.clipboard.writeText(window.location.href);
            shareBtn.innerHTML = '<span style="font-size: 1.2em;">✅</span><span>Kopyalandı!</span>';
            setTimeout(() => {
                shareBtn.innerHTML = originalContent;
                (shareBtn as HTMLButtonElement).disabled = false;
            }, 2000);
        } catch (clipboardError) {
            shareBtn.innerHTML = '<span style="font-size: 1.2em;">❌</span><span>Hata!</span>';
            setTimeout(() => {
                shareBtn.innerHTML = originalContent;
                (shareBtn as HTMLButtonElement).disabled = false;
            }, 2000);
        }
    }
}
