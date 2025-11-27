// Redefined editor.js to work with the Static Sidebar
// It no longer creates DOM elements, but populates existing ones.

Familienbaum.prototype.create_editing_form = function(node_of_dag, node_of_dag_all) {
	// 1. Update Tree View (Expand/Highlight)
	for (let node of this.get_relationship_in_dag_all(node_of_dag_all))
		node.added_data.is_visible = true;
	    this.draw(true, node_of_dag_all.data);
	    
	    // 2. Get Data
	    let name = get_name(node_of_dag) || "İsimsiz";
	    
	    // 3. Populate Sidebar    const sidebar = document.getElementById('family-sidebar');
    const titleEl = document.getElementById('sidebar-title');
    const detailsEl = document.getElementById('sidebar-details');
    const btnParents = document.getElementById('btn-parents');
    const btnChildren = document.getElementById('btn-children');
    
    // Set Title
    titleEl.innerText = name;
    
    // Set Details
    let detailsHtml = "";
    if (is_member(node_of_dag)) {
        const data = node_of_dag.added_data.input;
        for (const [key, value] of Object.entries(data)) {
            if (typeof value != "string" || key.startsWith("_") || value === "") continue;
            if (key === "image_path") continue;
            
            let displayVal = value;
            if (value.startsWith("http")) displayVal = `<a href="${value}" target="_blank">Bağlantı</a>`;
            
            detailsHtml += `<div class="info-row"><span class="info-label">${key}:</span> ${displayVal}</div>`;
        }
    } else {
        detailsHtml = "<em>Aile Bağlantısı</em>";
    }
    detailsEl.innerHTML = detailsHtml;
    
    // Bind Actions to Buttons (Remove old listeners first by cloning? No, onclick override is safer here)
    btnParents.onclick = () => {
        let parents = Array.from(this.dag_all.parents(node_of_dag_all));
		while (parents.length > 0) {
			let parent = parents.pop();
			parent.added_data.is_visible = true;
			parents = parents.concat(this.dag_all.parents(parent));
		}
		this.draw(false);
    };
    
    btnChildren.onclick = () => {
        let children = Array.from(node_of_dag_all.children());
		while (children.length > 0) {
			let child = children.pop();
			child.added_data.is_visible = true;
			children = children.concat(Array.from(child.children()));
		}
		this.draw(false);
    };

    // 4. Show Sidebar
    sidebar.classList.add('active');
}

Familienbaum.prototype.create_info_form = function() {
    // For the 'i' button, we can just open the sidebar with generic info or an alert
    // or open the sheet directly.
    // Let's open the sheet directly for simplicity as per user preference for robustness.
    window.open("https://docs.google.com/spreadsheets/d/109453623070216066764/edit", "_blank");
}