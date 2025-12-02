import { Dag } from './dag';
import { D3Node } from '../../types/types';

export class DagWithRelations extends Dag {
    exist_parents: boolean = false;
    exist_first_level_adjacencies: boolean = false;
    exist_second_level_adjacencies: boolean = false;

    constructor(links: Array<[string, string]>) {
        super(links);
        if (links.length <= 0) throw "Cannot handle a dataset without links";
    }

    parents(node: D3Node): D3Node[] {
        this.add_parents();
        return node.added_relations!.parents!;
    }

    first_level_adjacency(node: D3Node): Set<D3Node> {
        this.add_first_level_adjacencies();
        return node.added_relations!.first_level_adjacency!;
    }

    second_level_adjacency(node: D3Node): Set<D3Node> {
        this.add_second_level_adjacencies();
        return node.added_relations!.second_level_adjacency!;
    }

    private add_parents() {
        if (this.exist_parents) return;
        this.exist_parents = true;
        // Add parents containers
        for (let node of this.nodes()) {
            if (!node.added_relations) node.added_relations = {};
            node.added_relations.parents = [];
        }
        // Parents of family nodes
        for (let link of this.links()) {
            link.target.added_relations!.parents!.push(link.source);
        }
    }

    private add_first_level_adjacencies() {
        if (this.exist_first_level_adjacencies) return;
        this.exist_first_level_adjacencies = true;
        // Add adjacency containers
        for (let node of this.nodes()) {
            if (!node.added_relations) node.added_relations = {};
            node.added_relations.first_level_adjacency = new Set();
        }
        // Add first level adjacent nodes
        for (let link of this.links()) {
            link.source.added_relations!.first_level_adjacency!.add(link.target);
            link.target.added_relations!.first_level_adjacency!.add(link.source);
        }
    }

    private add_second_level_adjacencies() {
        if (this.exist_second_level_adjacencies) return;
        this.exist_second_level_adjacencies = true;

        // Merge adjacency from a family node to a member node
        const merge_adjacency = (node_from: D3Node, node_to: D3Node) => {
            for (let node of this.first_level_adjacency(node_from))
                node_to.added_relations!.second_level_adjacency!.add(node);
        };

        // Add adjacency containers
        for (let node of this.nodes()) {
            if (!node.added_relations) node.added_relations = {};
            // Initialize with first level adjacency
            node.added_relations.second_level_adjacency = new Set();
        }

        // Add second level adjacent nodes
        for (let link of this.links()) {
            merge_adjacency(link.source, link.source);
            merge_adjacency(link.target, link.target);
            merge_adjacency(link.source, link.target);
            merge_adjacency(link.target, link.source);
        }
    }
}

export function get_roots(dag: DagWithRelations): Set<D3Node> {
    let roots = new Set<D3Node>();
    for (let node of dag.nodes()) {
        // Is it a root?
        let parents = dag.parents(node);
        if (parents.length <= 0) {
            roots.add(node);
            continue;
        }
    }
    return roots;
}
