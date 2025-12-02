import { D3Node, D3Link } from '../../types/types';

/** Creates a DAG for given links */
export class Dag {
    data: {
        node_ids: string[];
        id_map: Map<string, number>;
        nodes: D3Node[];
        links: D3Link[];
    };

    constructor(links: Array<[string, string]>) {
        // Store all members in object "data"
        this.data = {
            node_ids: [],
            id_map: new Map(),
            nodes: [],
            links: []
        };

        this.data.node_ids = [...new Set(links.flat())];
        this.data.node_ids.sort();
        this.data.nodes = new Array(this.data.node_ids.length);

        // Create the node objects
        for (let [i, node_id] of this.data.node_ids.entries()) {
            const node: any = {};
            node.data = node_id;
            node.relations = {};
            node.relations.children = [];
            node.children = function () {
                return this.relations.children;
            };
            this.data.nodes[i] = node;
            this.data.id_map.set(node_id, i);
        }

        // Create the link objects
        this.data.links = new Array(links.length);
        for (let [i, link] of links.entries()) {
            const linkObj: any = {};
            let source = this.find_node(link[0]);
            let target = this.find_node(link[1]);
            linkObj.source = source;
            linkObj.target = target;
            this.data.links[i] = linkObj;
            (source as any).relations.children.push(target);
        }
    }

    find_node(node_id: string): D3Node {
        if (!this.data.id_map.has(node_id)) throw "Node " + node_id + " not found";
        let i = this.data.id_map.get(node_id)!;
        return this.data.nodes[i];
    }

    links(): D3Link[] {
        return this.data.links;
    }

    nodes(): D3Node[] {
        return this.data.nodes;
    }
}
