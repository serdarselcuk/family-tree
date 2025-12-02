import { D3Node } from '../../types/types';

export let currentEditedNode: D3Node | null = null;
export function setCurrentEditedNode(node: D3Node | null) {
    currentEditedNode = node;
}

export let pendingChildPhoto: File | null = null;
export function setPendingChildPhoto(file: File | null) {
    pendingChildPhoto = file;
}
