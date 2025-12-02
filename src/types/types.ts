export interface Member {
    id: string;
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    death_date?: string;
    birth_place?: string;
    death_place?: string;
    is_spouse?: boolean;
    gender?: 'E' | 'K';
    gen?: number;
    persistentId?: string;
    name?: string;
    [key: string]: any; // Allow other properties for now
}

export interface Link {
    source: string | D3Node;
    target: string | D3Node;
}

export interface FamilyData {
    members: { [key: string]: Member };
    links: Array<[string, string]>; // Array of [sourceId, targetId]
    start: string;
}

export interface AddedData {
    x0?: number;
    y0?: number;
    is_visible?: boolean;
    is_highlighted?: boolean;
    age?: number;
    input?: any;
}

export interface D3Node {
    data: string; // The ID
    x: number;
    y: number;
    added_data: AddedData;
    added_relations?: {
        parents?: D3Node[];
        first_level_adjacency?: Set<D3Node>;
        second_level_adjacency?: Set<D3Node>;
        layout?: any;
        [key: string]: any;
    };
    parent?: D3Node;
    children?: () => D3Node[];
}

export interface D3Link {
    source: D3Node;
    target: D3Node;
}
