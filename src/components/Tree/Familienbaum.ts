import * as d3 from 'd3';
import { DagWithFamilyData, dag_with_family_data, is_member } from './dagWithFamilyData';
import { DagLayout } from './DagLayout';
import { D3Node, FamilyData } from '../../types/types';
import { TreeRenderer } from './TreeRenderer';


export class Familienbaum {
    data: FamilyData;
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
    g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    info: d3.Selection<SVGTextElement, unknown, HTMLElement, any>;
    transition_milliseconds: number;
    dag_all!: DagWithFamilyData;
    dag: DagWithFamilyData | undefined;
    layout: DagLayout | undefined;
    editing_div: any; // Placeholder for editor
    renderer: TreeRenderer;

    // Callbacks
    onViewChange?: () => void;
    create_editing_form?: (node: D3Node, node_all: D3Node) => void;
    create_info_form?: () => void;

    constructor(input: FamilyData, svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>, onViewChange?: () => void) {
        // Remember the inputs
        this.data = input;
        this.svg = svg;
        this.onViewChange = onViewChange;

        // Prepare things related to d3 and SVG
        this.g = this.svg.append("g");
        this.zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
            this.g.attr("transform", event.transform);
            if (this.onViewChange) this.onViewChange();
        });
        this.svg.call(this.zoom);
        // Make scroll zoom slower and smoother
        this.zoom.wheelDelta((event) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0005)); // Default is 0.002
        this.info = this.add_info_text(svg);
        // Set the duration of a transition
        this.transition_milliseconds = 500;

        // Initialize Renderer
        this.renderer = new TreeRenderer(
            this.g,
            (node, event) => this.handleNodeClick(node, event),
            (node, event) => this.handleNodeDblClick(node, event),
            (node) => this.handleEditClick(node)
        );

        // Create the DAGs
        this.reset_dags();
    }

    reset_dags() {
        // Check that links and members exist
        if (!this.data.links) throw "No links in input";
        if (!this.data.members) throw "No members in input";
        if (!this.data.start) throw "No starting node ID in input";
        // Create the entire DAG and read input
        this.dag_all = dag_with_family_data(this.data.links, this.data.members);
        this.dag = undefined; // the part of the DAG that will be visualized
        // Find starting node and set node coordinates
        let node_of_dag_all = this.dag_all.find_node(this.data.start);
        node_of_dag_all.added_data.x0 = parseFloat(this.svg.attr("height")) / 2;
        node_of_dag_all.added_data.y0 = parseFloat(this.svg.attr("width")) / 2;
        node_of_dag_all.added_data.is_visible = true;
        // Choose visible nodes at the beginning
        for (let node of this.get_relationship_in_dag_all(node_of_dag_all)) {
            node.added_data.is_visible = true;
        }
    }

    handleNodeClick(node: D3Node, event: any) {
        // Check if sidebar is open
        const sidebar = document.getElementById('family-sidebar');
        const sidebarIsOpen = sidebar && sidebar.classList.contains('active');

        // If sidebar is open (with or without shift key), switch to that person
        if (sidebarIsOpen) {
            this.handleEditClick(node);
            return;
        }

        // Check for Shift key when sidebar is closed
        if (event.shiftKey) {
            this.handleEditClick(node);
            return;
        }

        // Only expand/collapse on circle click when sidebar is closed and no shift key
        this.click(node.data);
        this.draw(true, node.data);
    }

    handleEditClick(node: D3Node) {
        if (typeof this.create_editing_form === "function") {
            let node_of_dag = node;
            let node_of_dag_all = this.dag_all.find_node(node.data);
            this.create_editing_form(node_of_dag, node_of_dag_all);
        }
    }

    handleNodeDblClick(node: D3Node, event: any) {
        let node_of_dag_all = this.dag_all.find_node(node.data);
        // Collapse Ancestors: Hide parents
        // Parents: Member <- Union <- Parent
        // dag_all.parents(node) returns Unions
        for (let unionNode of this.dag_all.parents(node_of_dag_all)) {
            unionNode.added_data.is_visible = false;
            for (let parentNode of this.dag_all.parents(unionNode)) {
                parentNode.added_data.is_visible = false;
            }
        }
        this.draw(true, node.data);
    }

    click(current_node_id: string) {
        // First find the clicked node
        let node_of_dag = this.dag!.find_node(current_node_id);
        let node_of_dag_all = this.dag_all.find_node(current_node_id);
        if (node_of_dag.added_data.is_highlighted) {
            // Mark all nodes of relationship as visible in unfiltered DAG
            let adjacents = this.get_relationship_in_dag_all(node_of_dag_all);
            for (let adjacent of adjacents)
                adjacent.added_data.is_visible = true;
        } else // not highlighted (already expanded)
        {
            // Collapse: Hide children only
            // Children: Member -> Union -> Child
            // dag_all.children() returns Unions (need cast to any or check implementation)
            let unions = (node_of_dag_all as any).children();
            if (unions) {
                for (let unionNode of unions) {
                    unionNode.added_data.is_visible = false;
                    let kids = (unionNode as any).children();
                    if (kids) {
                        for (let childNode of kids) {
                            childNode.added_data.is_visible = false;
                        }
                    }
                }
            }
        }
    }

    draw(recenter = true, current_node_id = this.data.start) {
        // Filter to include only links between visible nodes
        let links: Array<[string, string]> = [];
        for (let link of this.dag_all.links())
            if (link.source.added_data.is_visible && link.target.added_data.is_visible)
                links.push([link.source.data, link.target.data]);
        // Create DAG on filtered edges
        this.dag_all.get_data_and_xy(this.dag as any); // if a filtered DAG exists, transfer data
        this.dag = dag_with_family_data(links); // create on filtered links
        this.dag.get_data_and_xy(this.dag_all); // now transfer data from unfiltered DAG
        // Mark expandable nodes to be highlighted
        for (let node of this.dag.nodes()) {
            let node_of_dag_all = this.dag_all.find_node(node.data);
            node.added_data.is_highlighted = this.is_expandable_in_dag_all(node_of_dag_all);
        }
        // Calculate layout
        this.layout = new DagLayout(this.dag, [80, 140]);
        this.layout.run();
        // Find current node in the filtered DAG
        let current_node = this.dag.find_node(this.data.start = current_node_id);

        // Save state to localStorage
        try {
            localStorage.setItem('soyagaci_last_node', current_node_id);
        } catch (e) { /* ignore */ }

        // Draw nodes and links via Renderer
        this.renderer.draw_nodes(this.dag.nodes(), current_node);
        this.renderer.draw_links(this.dag.links(), current_node);

        // Recenter the entire DAG to window
        if (recenter)
            this.svg.transition()
                .duration(this.transition_milliseconds)
                .call(
                    this.zoom.transform,
                    d3.zoomTransform(this.g.node()!)
                        .translate(current_node.added_data.y0! - current_node.y,
                            current_node.added_data.x0! - current_node.x),
                );
        // Store current node positions for next transition
        for (let node of this.dag.nodes()) {
            node.added_data.x0 = node.x;
            node.added_data.y0 = node.y;
        }

        // Update URL after drawing to reflect new state
        if (this.onViewChange) this.onViewChange();
    }

    get_relationship_in_dag_all(node: D3Node) {
        if (is_member(node)) return this.dag_all.second_level_adjacency(node); // member node
        return this.dag_all.first_level_adjacency(node); // family node
    }

    is_expandable_in_dag_all(node: D3Node) {
        let adjacents = Array.from(this.get_relationship_in_dag_all(node));
        return adjacents.some(adjacent => !adjacent.added_data.is_visible);
    }

    add_info_text(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>) {
        return svg.append("text")
            .on("click", _ => {
                // this.editing_div.selectAll("form").remove(); // TODO: Handle this via callback
                if (this.create_info_form) this.create_info_form();
            })
            .attr("cursor", "pointer")
            .attr("class", "info-text")
            .attr("x", parseFloat(svg.attr("width")) - 16)
            .attr("y", "24pt")
            .text("ⓘ");
    }
}
