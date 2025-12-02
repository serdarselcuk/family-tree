import { DagWithRelations } from './dagWithRelations';
import { D3Node, Member } from '../../types/types';

export class DagWithFamilyData extends DagWithRelations {
    constructor(links: Array<[string, string]>, input_per_node_id: { [key: string]: Member } = {}) {
        super(links);
        // Transfer input data if available
        for (let node of this.nodes()) {
            node.added_data = {
                is_visible: false,
                is_highlighted: false
            };
            if (node.data in input_per_node_id) {
                (node.added_data as any).input = input_per_node_id[node.data];
            }
        }
    }

    get_data_and_xy(from_dag: DagWithFamilyData) {
        get_data_and_xy(from_dag, this);
    }
}

export function dag_with_family_data(links: Array<[string, string]>, input_per_node_id: { [key: string]: Member } = {}) {
    return new DagWithFamilyData(links, input_per_node_id);
}

export function get_name(node: D3Node): string {
    if (!(node.added_data as any).input) return "?";
    const input = (node.added_data as any).input;
    for (let key of ["Name", "name"])
        if (input.hasOwnProperty(key))
            if (input[key] != "") return input[key];
    return "?";
}

export function get_second_names(node: D3Node): string {
    if (!(node.added_data as any).input) return "";
    const input = (node.added_data as any).input;
    for (let key of ["Zweitnamen", "second_names"])
        if (input.hasOwnProperty(key))
            if (input[key] != "") return input[key];
    return "";
}

export function get_birth_date_of_member(member: Member): string {
    for (let key of ["Geburtstag", "birth_date"])
        if (member.hasOwnProperty(key))
            if (member[key] != "") return member[key];
    return "?";
}

export function get_birth_date(node: D3Node): string {
    if (!(node.added_data as any).input) return "?";
    return get_birth_date_of_member((node.added_data as any).input);
}

export function get_death_date(node: D3Node): string {
    if (!(node.added_data as any).input) return "";
    const input = (node.added_data as any).input;
    for (let key of ["Todestag", "death_date"])
        if (input.hasOwnProperty(key)) return input[key];
    return "";
}

export function get_birth_place(node: D3Node): string {
    if (!(node.added_data as any).input) return "?";
    const input = (node.added_data as any).input;
    for (let key of ["Geburtsort", "birth_place"])
        if (input.hasOwnProperty(key))
            if (input[key] != "") return input[key];
    return "";
}

export function get_death_place(node: D3Node): string {
    if (!(node.added_data as any).input) return "";
    const input = (node.added_data as any).input;
    for (let key of ["Todesort", "death_place"])
        if (input.hasOwnProperty(key)) return input[key];
    return "";
}

export function get_marriage(node: D3Node): string {
    if (!(node.added_data as any).input) return "";
    const input = (node.added_data as any).input;
    for (let key of ["Hochzeit", "marriage"])
        if (input.hasOwnProperty(key)) return input[key];
    return "";
}

export function get_occupation(node: D3Node): string {
    if (!(node.added_data as any).input) return "";
    const input = (node.added_data as any).input;
    for (let key of ["Beruf", "occupation"])
        if (input.hasOwnProperty(key)) return input[key];
    return "";
}

export function get_note(node: D3Node): string {
    if (!(node.added_data as any).input) return "";
    const input = (node.added_data as any).input;
    for (let key of ["Notiz", "note"])
        if (input.hasOwnProperty(key)) return input[key];
    return "";
}

export function get_year_from_string(date_string: string, default_year: number): number {
    if (date_string == "?") return default_year;
    let numbers = String(date_string).match(/\d+/gi);
    if (!numbers) return default_year;
    const validNumbers = numbers.filter(x => Number(x) > 31);
    if (validNumbers.length <= 0) {
        return default_year;
    } else {
        return Number(validNumbers[0]);
    }
}

export function get_year_of_birth_date(node: D3Node): number {
    const date_string = get_birth_date(node);
    return get_year_from_string(date_string, 1980);
}

export function get_image_path(node: D3Node): string {
    if (!(node.added_data as any).input) return "";
    const input = (node.added_data as any).input;
    for (let key of ["image_path"])
        if (input.hasOwnProperty(key)) return input[key];
    return "";
}

function get_data_and_xy(dag_1: DagWithFamilyData, dag_2: DagWithFamilyData) {
    // If one of the DAGs are not yet defined, return
    if ((!dag_1) || (!dag_2)) return;
    let nodes_1 = Array.from(dag_1.nodes());
    for (let node_2 of dag_2.nodes()) {
        let node_1 = nodes_1.find(node => node.data == node_2.data);
        if (!node_1) continue;
        // Note: Use ux and uy to avoid exception if undefined
        // Assuming ux/uy are meant to be x/y or stored previous positions
        // In original code: node_1.ux, node_1.uy. But where are they defined?
        // They might be undefined, which is handled.
        // Let's use x and y if ux/uy are not present on type, or cast to any.
        node_2.x = (node_1 as any).ux || node_1.x;
        node_2.y = (node_1 as any).uy || node_1.y;
        node_2.added_data = node_1.added_data;
    }
}

export function is_member(node: D3Node): boolean {
    return (node.added_data as any).input != undefined;
}
