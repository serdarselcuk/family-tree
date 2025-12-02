import { describe, it, expect } from 'vitest';
import { get_name, is_member, get_birth_date } from '../src/dagWithFamilyData';
import { D3Node } from '../src/types';

describe('dagWithFamilyData helpers', () => {
    it('should extract name correctly', () => {
        const node: D3Node = {
            data: 'mem_0',
            added_data: {
                input: { name: 'John Doe', first_name: 'John', last_name: 'Doe' }
            }
        } as any;

        expect(get_name(node)).toBe('John Doe');
    });

    it('should identify members vs unions', () => {
        const memberNode: D3Node = {
            data: 'mem_0',
            added_data: { input: {} }
        } as any;
        const unionNode: D3Node = {
            data: 'u_0_1',
            added_data: {} // Unions don't have 'input'
        } as any;

        expect(is_member(memberNode)).toBe(true);
        expect(is_member(unionNode)).toBe(false);
    });

    it('should extract birth date', () => {
        const node: D3Node = {
            data: 'mem_0',
            added_data: {
                input: { birth_date: '1990' }
            }
        } as any;

        expect(get_birth_date(node)).toBe('1990');
    });
});
