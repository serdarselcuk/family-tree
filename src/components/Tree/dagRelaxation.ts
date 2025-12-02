import { D3Node } from '../../types/types';
import { DagWithFamilyData } from './dagWithFamilyData';

export class DagRelaxation {
    dag: DagWithFamilyData;
    node_size: [number, number];

    constructor(dag_with_coordinates: DagWithFamilyData, node_size: [number, number]) {
        this.dag = dag_with_coordinates;
        this.node_size = node_size;
    }

    run(nodes: D3Node[]) {
        let number_of_passes = 10 * nodes.length;
        for (let pass = 0; pass < number_of_passes; pass++) {
            for (let [i, node] of nodes.entries()) {
                let gravity = 0.1 / number_of_passes;
                let force = 0.0;
                if (i < nodes.length - 1) {
                    force += this.get_pressure(nodes[i + 1], node, this.node_size[0]);
                }
                if (i > 0) {
                    force += this.get_pressure(nodes[i - 1], node, this.node_size[0]);
                }
                for (let parent of this.dag.parents(node)) {
                    force += gravity * this.get_gravity(parent, node);
                }
                // node.children is a function in our implementation
                for (let child of node.children!()) {
                    force += gravity * this.get_gravity(child, node);
                }
                node.x += force;
            }
        }
        // Enforce that there is no overlap
        this.enforce_placement(nodes);
    }

    enforce_placement(nodes: D3Node[]) {
        let position_x = Number.NEGATIVE_INFINITY;
        for (let node of nodes) {
            position_x += this.node_size[0];
            if (node.x < position_x) {
                node.x = position_x;
            } else {
                position_x = node.x;
            }
        }
    }

    get_gravity(neighbor: D3Node, node: D3Node) {
        return neighbor.x - node.x;
    }

    get_pressure(neighbor: D3Node, node: D3Node, node_size_x: number) {
        let difference = node.x - neighbor.x;
        let distance = Math.abs(difference);
        let overlap = node_size_x - distance;
        if (overlap < 0.0) return 0.0;
        let direction = (difference < 0.0 ? -1.0 : 1.0);
        return overlap * direction;
    }
}
