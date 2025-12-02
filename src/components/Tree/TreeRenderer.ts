import * as d3 from 'd3';
import { D3Node } from '../../types/types';
import { is_member } from './dagWithFamilyData';
import { get_node_size, get_css_class, add_images } from './NodeHelpers';
import { set_multiline } from './LabelHelpers';

export class TreeRenderer {
    g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    transition_milliseconds: number = 500;

    // Callbacks
    onNodeClick: (node: D3Node, event: any) => void;
    onNodeDblClick: (node: D3Node, event: any) => void;
    onEditClick: (node: D3Node) => void;

    constructor(
        g: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
        onNodeClick: (node: D3Node, event: any) => void,
        onNodeDblClick: (node: D3Node, event: any) => void,
        onEditClick: (node: D3Node) => void
    ) {
        this.g = g;
        this.onNodeClick = onNodeClick;
        this.onNodeDblClick = onNodeDblClick;
        this.onEditClick = onEditClick;
    }

    draw_nodes(nodes: D3Node[], current_node: D3Node) {
        // Sort in order to draw members on top of family nodes
        let nodes_to_draw = Array.from(nodes);
        nodes_to_draw.sort((node_1, node_2) => {
            let node_pair = [node_1, node_2];
            let compare = node_pair.map(is_member);
            if (compare[0] > compare[1]) return 1;
            if (compare[0] < compare[1]) return -1;
            return node_1.data > node_2.data ? 1 : -1;
        });

        // The data is connected by providing a key function
        let nodes_selected = this.g.selectAll<SVGGElement, D3Node>("g.node").data(nodes_to_draw, node => node.data);

        // Entering nodes will appear at current_node position
        let node_enter_group = nodes_selected.enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", _ => "translate(" + current_node.added_data.y0 + "," + current_node.added_data.x0 + ")")
            .attr("visible", "true");

        // Add the nodes' labels
        node_enter_group.each(function (node) {
            set_multiline(d3.select(this), node, true)
        });

        const that = this;

        // Add a group that will contain the circle and the text
        let circle_group = node_enter_group.append("g")
            .attr("cursor", "pointer")
            .on("click", function (event, node) {
                if (event.defaultPrevented) return;
                that.onNodeClick(node, event);
            })
            .on("dblclick", function (event, node) {
                if (event.defaultPrevented) return;
                event.stopPropagation(); // Prevent zoom on double click
                that.onNodeDblClick(node, event);
            });

        // Add a circle as SVG object
        circle_group.append("circle")
            .attr("class", get_css_class)
            .attr("r", node => get_node_size() / (is_member(node) ? 1.0 : 4.0));

        // Add the images
        add_images(circle_group);

        // Add editing functionality (Pen Sign)
        node_enter_group.append("g")
            .attr("cursor", "pointer")
            .on("click", (_event, node) => that.onEditClick(node))
            .append("text")
            .attr("cursor", "pointer")
            .attr("class", "plus-label")
            .attr("font-size", "50%")
            .append("tspan")
            .attr("text-anchor", "middle")
            .attr("y", node => -get_node_size() / (is_member(node) ? 1.1 : 3.0))
            .attr("x", node => get_node_size() / (is_member(node) ? 1.1 : 3.0))
            .text("✎");

        // The nodes to be updated
        let node_update = node_enter_group.merge(nodes_selected);

        // Define the transition
        node_update.transition()
            .duration(this.transition_milliseconds)
            .attr("transform", node => "translate(" + node.y + "," + node.x + ")");

        // Update highlighted status
        node_update.select("circle").attr("class", get_css_class);

        // Remove any node that becomes invisible
        let node_exit = nodes_selected.exit()
            .transition()
            .duration(this.transition_milliseconds / 5)
            .attr("visible", "false")
            .remove();

        // Fade labels of nodes being removed
        node_exit.select("text").style("fill-opacity", 1e-6);
        // Fade circles of nodes being removed
        node_exit.select("circle").style("fill-opacity", 1e-6).style("stroke-opacity", 1e-6);
    }

    draw_links(links: any[], current_node: D3Node) {
        function get_curved_edge(s: any, d: any) {
            return `M ${s.y} ${s.x} C ${(s.y + d.y) / 2} ${s.x}, 
				${(s.y + d.y) / 2} ${d.x}, 
				${d.y} ${d.x}`;
        }

        let link = this.g.selectAll("path.link").data(links, (link: any) => link.source.data + "_" + link.target.data);

        let link_enter = link.enter().insert("path", "g").attr("class", "link").attr("d", function () {
            let o = { x: current_node.added_data.x0, y: current_node.added_data.y0 };
            return get_curved_edge(o, o);
        });

        let link_update = link_enter.merge(link as any);

        link_update.transition()
            .duration(this.transition_milliseconds)
            .attr("d", (link: any) => get_curved_edge(link.source, link.target));

        link.exit()
            .transition()
            .duration(this.transition_milliseconds / 5)
            .style("stroke-opacity", 1e-6)
            .remove();
    }
}
