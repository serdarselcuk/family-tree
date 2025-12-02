import * as d3 from 'd3';
import { D3Node } from '../../types/types';
import { is_member, get_death_date, get_image_path } from './dagWithFamilyData';

export function get_node_size() {
    return 28;
}

export function get_css_class(node: D3Node) {
    if (!is_member(node)) return "family";
    let cssClass = "member";
    if (!node.added_data.is_highlighted) {
        cssClass += " non-highlighted";
    } else {
        cssClass += " highlighted";
    }
    if (get_death_date(node)) {
        cssClass += " deceased";
    }
    return cssClass;
}

export function add_images(group: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown>) {
    function get_clip_path_id(node: D3Node) {
        return "clip_to_circle_" + node.data;
    };
    group.append("defs")
        .append("clipPath")
        .attr("id", node => get_clip_path_id(node))
        .append("circle")
        .attr("r", get_node_size() - 1.0);
    let image_size = 2.0 * get_node_size();
    group.append("image")
        .attr("x", -image_size / 2.0)
        .attr("y", -image_size / 2.0)
        .attr("width", image_size)
        .attr("height", image_size)
        .attr("href", node => get_image_path(node))
        .attr("referrerpolicy", "no-referrer")
        .attr("clip-path", node => "url(#" + get_clip_path_id(node) + ")")
        .attr("cursor", "pointer");
}
