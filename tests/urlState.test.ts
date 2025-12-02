import { describe, it, expect, beforeEach } from 'vitest';
import { encodeState, decodeState, buildIdMaps, persistentIdMap } from '../src/urlState';
import { FamilyData } from '../src/types';

describe('urlState', () => {
    // Mock window.location and history
    const originalLocation = window.location;
    const originalHistory = window.history;

    beforeEach(() => {
        // Reset maps
        persistentIdMap.clear();

        // Mock window.location
        delete (window as any).location;
        (window as any).location = {
            hash: '',
            pathname: '/',
            search: ''
        };

        // Mock history
        (window as any).history = {
            replaceState: (state: any, title: string, url: string) => {
                window.location.hash = url.startsWith('#') ? url : '';
            }
        };
    });

    // Restore after all tests (optional, but good practice)
    // afterAll(() => { window.location = originalLocation; ... });

    it('should encode and decode state correctly', () => {
        const data: FamilyData = {
            start: 'mem_0',
            members: {
                'mem_0': { id: 'mem_0', name: 'John Doe', first_name: 'John', last_name: 'Doe', birth_date: '1990', is_spouse: false } as any
            },
            links: []
        };

        buildIdMaps(data);
        const pid = persistentIdMap.get('joh_doe_90'); // Expected ID format

        // Test Encode
        const transform = { k: 1, x: 100, y: 200 };
        const visibleNodes = new Set(['mem_0']);
        const encoded = encodeState('mem_0', transform, true, visibleNodes);

        expect(encoded).toBeTruthy();

        // Set hash for decode
        window.location.hash = '#' + encoded;

        // Test Decode
        const decoded = decodeState();
        expect(decoded).toBeTruthy();
        expect(decoded.currentNode).toBe('mem_0');
        expect(decoded.patrilineal).toBe(true);
        expect(decoded.transform.k).toBe(1);
        expect(decoded.visibleNodes.has('mem_0')).toBe(true);
    });

    it('should return null for invalid hash', () => {
        window.location.hash = '#invalid_base64_json';
        const decoded = decodeState();
        expect(decoded).toBeNull();
    });
});
