import { D3Node } from '../../types/types';
import { store } from '../../services/state/store';
import { submitNewChild, submitNewSpouse, submitMoveChild } from './actions';
import { setPendingChildPhoto, currentEditedNode } from './state';

export function renderFormFields(container: HTMLElement, data: any) {
    const fieldsToEdit = [
        { key: "first_name", label: "Ad", type: "text" },
        { key: "last_name", label: "Soyad", type: "text" },
        {
            key: "gender", label: "Cinsiyet", type: "select", options: [
                { value: "E", label: "Erkek" },
                { value: "K", label: "Kadın" },
                { value: "U", label: "Belirsiz" }
            ]
        },
        { key: "birth_date", label: "Doğum Tarihi", type: "text" },
        { key: "birthplace", label: "Doğum Yeri", type: "text" },
        { key: "death_date", label: "Ölüm Tarihi", type: "text" },
        { key: "marriage", label: "Evlilik Tarihi", type: "text" },
        { key: "note", label: "Not", type: "text" }
    ];

    let html = `<div class="edit-form">`;
    fieldsToEdit.forEach((field: any) => {
        const value = data[field.key] || "";

        html += `<div class="info-row">`;

        if (field.type === "select") {
            html += `<select class="sidebar-input" data-key="${field.key}">
                        <option value="" disabled ${value === "" ? "selected" : ""}>${field.label}</option>`;
            field.options.forEach((opt: any) => {
                const selected = value === opt.value ? 'selected' : '';
                html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
            });
            html += `</select>`;
        } else {
            html += `<input type="text" class="sidebar-input" data-key="${field.key}" value="${value}" placeholder="${field.label}">`;
        }

        html += `
            </div>
         `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

export function showAddChildForm(node: D3Node) {
    const titleEl = document.getElementById('sidebar-title');
    const detailsEl = document.getElementById('sidebar-details');
    const imageEl = document.getElementById('sidebar-image') as HTMLImageElement;

    if (!detailsEl || !imageEl || !titleEl) return;

    // Show placeholder image for new child
    const placeholder = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
    imageEl.src = placeholder;
    imageEl.style.display = "inline-block";
    imageEl.style.cursor = "pointer";
    imageEl.title = "Fotoğraf eklemek için tıklayın";

    // Reset pending photo
    setPendingChildPhoto(null);

    // Clear upload status from previous operations (if any)
    const statusEl = document.getElementById('save-status');
    if (statusEl) statusEl.innerText = "";

    // Hide delete photo button (no photo yet for new child)
    const deletePhotoBtn = document.getElementById('delete-photo-btn');
    if (deletePhotoBtn) deletePhotoBtn.style.display = "none";

    // Set a flag that we're in "add child" mode
    imageEl.dataset.addChildMode = "true";
    imageEl.dataset.deletePhoto = "false";

    // Click image to select photo (use normal flow with cropper)
    imageEl.onclick = () => {
        const input = document.getElementById('image-upload-input');
        if (input) input.click();
    };

    // Set Title
    titleEl.innerText = "Yeni Çocuk Ekle";

    // Pre-fill Data
    const parentSurname = (node.added_data as any).input.last_name || "";
    const emptyData = { last_name: parentSurname };

    // Render Form
    renderFormFields(detailsEl, emptyData);

    // Add Buttons
    const btnContainer = document.createElement("div");
    btnContainer.style.marginTop = "15px";
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "space-between";

    const btnCancel = document.createElement("button");
    btnCancel.className = "action-btn btn-secondary";
    btnCancel.innerText = "İptal";
    btnCancel.onclick = () => {
        // Revert to Edit Mode
        if (typeof currentEditedNode !== 'undefined') {
            const sidebar = document.getElementById('family-sidebar');
            if (sidebar) sidebar.classList.remove('active');
        }
    };

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "action-btn btn-success";
    btnConfirm.innerText = "✅ Çocuğu Ekle";
    btnConfirm.onclick = () => submitNewChild(node);

    btnContainer.appendChild(btnCancel);
    btnContainer.appendChild(btnConfirm);
    detailsEl.appendChild(btnContainer);

    // Add Status Area
    const status = document.createElement("div");
    status.id = "add-status";
    status.style.marginTop = "10px";
    status.style.textAlign = "center";
    status.style.fontSize = "0.9em";
    detailsEl.appendChild(status);
}

export function showAddSpouseForm(node: D3Node) {
    const titleEl = document.getElementById('sidebar-title');
    const detailsEl = document.getElementById('sidebar-details');
    const imageEl = document.getElementById('sidebar-image') as HTMLImageElement;

    if (!detailsEl || !imageEl || !titleEl) return;

    // Show placeholder image for new spouse
    const placeholder = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
    imageEl.src = placeholder;
    imageEl.style.display = "inline-block";
    imageEl.style.cursor = "pointer";
    imageEl.title = "Fotoğraf eklemek için tıklayın";

    // Reset pending photo
    setPendingChildPhoto(null);

    // Clear upload status from previous operations (if any)
    const statusEl = document.getElementById('save-status');
    if (statusEl) statusEl.innerText = "";

    // Hide delete photo button (no photo yet for new spouse)
    const deletePhotoBtn = document.getElementById('delete-photo-btn');
    if (deletePhotoBtn) deletePhotoBtn.style.display = "none";

    // Set a flag that we're in "add spouse" mode
    imageEl.dataset.addSpouseMode = "true"; // New flag for spouse
    imageEl.dataset.deletePhoto = "false";

    // Click image to select photo (use normal flow with cropper)
    imageEl.onclick = () => {
        const input = document.getElementById('image-upload-input');
        if (input) input.click();
    };

    // Set Title
    titleEl.innerText = "Yeni Eş Ekle";

    // Pre-fill Data
    const spouseSurname = (node.added_data as any).input.last_name || ""; // Spouse takes same surname initially
    const emptyData = { last_name: spouseSurname };

    // Render Form
    renderFormFields(detailsEl, emptyData);

    // Add Buttons
    const btnContainer = document.createElement("div");
    btnContainer.style.marginTop = "15px";
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "space-between";

    const btnCancel = document.createElement("button");
    btnCancel.className = "action-btn btn-secondary";
    btnCancel.innerText = "İptal";
    btnCancel.onclick = () => {
        if (typeof currentEditedNode !== 'undefined') {
            const sidebar = document.getElementById('family-sidebar');
            if (sidebar) sidebar.classList.remove('active');
        }
    };

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "action-btn btn-success";
    btnConfirm.innerText = "✅ Eşi Ekle";
    btnConfirm.onclick = () => submitNewSpouse(node);

    btnContainer.appendChild(btnCancel);
    btnContainer.appendChild(btnConfirm);
    detailsEl.appendChild(btnContainer);

    // Add Status Area (re-use add-status or create a new one if needed)
    const status = document.createElement("div");
    status.id = "add-status"; // Re-using the same status div as for child
    status.style.marginTop = "10px";
    status.style.textAlign = "center";
    status.style.fontSize = "0.9em";
    detailsEl.appendChild(status);
}

export function showMoveChildForm(node: D3Node) {
    const titleEl = document.getElementById('sidebar-title');
    const detailsEl = document.getElementById('sidebar-details');
    const imageEl = document.getElementById('sidebar-image') as HTMLImageElement;

    if (!detailsEl || !imageEl || !titleEl) return;

    // Set Title
    titleEl.innerText = "Ebeveyn Değiştir";

    // Clear Details
    detailsEl.innerHTML = "";

    // Get All Potential Parents (Heads of Families)
    const familyData = store.getState().familyData;
    const potentialParents: any[] = [];

    if (familyData && familyData.members) {
        Object.values(familyData.members).forEach((m: any) => {
            // Filter: Must not be self, must not be a spouse (usually heads are not spouses)
            if (m.id !== node.data && !m.is_spouse) {
                potentialParents.push(m);
            }
        });
    }

    // Sort by name
    potentialParents.sort((a, b) => (a.first_name + " " + a.last_name).localeCompare(b.first_name + " " + b.last_name));

    // Create Form
    const container = document.createElement("div");
    container.className = "edit-form";

    // Parent Dropdown
    const parentGroup = document.createElement("div");
    parentGroup.className = "info-row";
    parentGroup.innerHTML = `<label style="display:block; margin-bottom:5px; font-weight:bold;">Yeni Ebeveyn (Baba/Baş):</label>`;

    const parentSelect = document.createElement("select");
    parentSelect.className = "sidebar-input";
    parentSelect.innerHTML = `<option value="" disabled selected>Seçiniz...</option>`;

    potentialParents.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id; // mem_X
        option.innerText = `${p.first_name} ${p.last_name} (${p.birth_date || "?"})`;
        parentSelect.appendChild(option);
    });

    parentGroup.appendChild(parentSelect);
    container.appendChild(parentGroup);

    // Spouse Dropdown (Dynamic)
    const spouseGroup = document.createElement("div");
    spouseGroup.className = "info-row";
    spouseGroup.style.marginTop = "15px";
    spouseGroup.innerHTML = `<label style="display:block; margin-bottom:5px; font-weight:bold;">Eş (Anne):</label>`;

    const spouseSelect = document.createElement("select");
    spouseSelect.className = "sidebar-input";
    spouseSelect.disabled = true;
    spouseSelect.innerHTML = `<option value="" selected>Önce Ebeveyn Seçin</option>`;

    spouseGroup.appendChild(spouseSelect);
    container.appendChild(spouseGroup);

    // Parent Change Listener
    parentSelect.onchange = () => {
        // const selectedParentId = parentSelect.value; // Unused
        spouseSelect.innerHTML = `<option value="">(Yok / Bilinmiyor)</option>`;
        spouseSelect.disabled = false;

        if (familyData && familyData.members) {
            Object.values(familyData.members).forEach((m: any) => {
                if (m.is_spouse) {
                    const option = document.createElement("option");
                    option.value = m.first_name; // We store Name in father/mother fields
                    option.innerText = `${m.first_name} ${m.last_name}`;
                    spouseSelect.appendChild(option);
                }
            });
        }
    };

    detailsEl.appendChild(container);

    // Buttons
    const btnContainer = document.createElement("div");
    btnContainer.style.marginTop = "15px";
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "space-between";

    const btnCancel = document.createElement("button");
    btnCancel.className = "action-btn btn-secondary";
    btnCancel.innerText = "İptal";
    btnCancel.onclick = () => {
        if (typeof currentEditedNode !== 'undefined') {
            const sidebar = document.getElementById('family-sidebar');
            if (sidebar) sidebar.classList.remove('active');
        }
    };

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "action-btn btn-success";
    btnConfirm.innerText = "✅ Taşı";
    btnConfirm.onclick = () => {
        const parentId = parentSelect.value;
        const spouseName = spouseSelect.value;

        if (!parentId) {
            alert("Lütfen bir ebeveyn seçin.");
            return;
        }
        submitMoveChild(node, parentId, spouseName);
    };

    btnContainer.appendChild(btnCancel);
    btnContainer.appendChild(btnConfirm);
    detailsEl.appendChild(btnContainer);

    // Status
    const status = document.createElement("div");
    status.id = "move-status";
    status.style.marginTop = "10px";
    status.style.textAlign = "center";
    detailsEl.appendChild(status);
}
