// import * as d3 from 'd3'; // Unused
import { Familienbaum } from '../../components/Tree/Familienbaum';
import { D3Node } from '../../types/types';
import { get_name, get_image_path, is_member } from '../../components/Tree/dagWithFamilyData';
import { COLUMN_MAPPING } from './config';
import { initImageCropper, uploadPhoto } from './image';
import { setCurrentEditedNode, setPendingChildPhoto } from './state';
import { saveData, deleteChild } from './actions';
import { showAddChildForm, showAddSpouseForm, showMoveChildForm } from './forms';

// Export a function to initialize editor
export function initEditor(familienbaum: Familienbaum) {
    // Initialize global event listeners for image cropping
    initImageCropper((file) => {
        const imageEl = document.getElementById('sidebar-image');
        if (!imageEl) return;

        const isAddChildMode = imageEl.dataset.addChildMode === "true";
        const isAddSpouseMode = imageEl.dataset.addSpouseMode === "true";

        if (isAddChildMode || isAddSpouseMode) {
            setPendingChildPhoto(file);

            // Show preview in sidebar
            const tempUrl = URL.createObjectURL(file);
            (imageEl as HTMLImageElement).src = tempUrl;

            // Update upload status
            const uploadStatus = document.getElementById('add-status');
            if (uploadStatus) {
                uploadStatus.innerText = `Fotoğraf hazır (${isAddChildMode ? "çocuk" : "eş"} eklendikten sonra yüklenecek)`;
                uploadStatus.style.color = "blue";
            }
        } else {
            // Normal edit mode: upload immediately
            // We need currentEditedNode here. It is stored in state.ts but we need to import it or access it.
            // Actually, we can just use the exported variable from state.ts if we import it.
            // But let's check if we can pass it.
            // The callback doesn't have access to currentEditedNode unless we import it.
            // Let's import it inside the callback or use the module level variable.
            import('./state').then(({ currentEditedNode }) => {
                if (currentEditedNode) {
                    uploadPhoto(file, currentEditedNode);
                }
            });
        }
    });

    familienbaum.create_editing_form = function (node_of_dag: D3Node, node_of_dag_all: D3Node) {
        setCurrentEditedNode(node_of_dag);
        const nameToIdMap = new Map<string, string>();

        // 1. Update Tree View (Expand/Highlight)
        for (let node of this.get_relationship_in_dag_all(node_of_dag_all))
            node.added_data.is_visible = true;
        this.draw(true, node_of_dag_all.data);

        // 2. Get Data
        let name = get_name(node_of_dag) || "İsimsiz";
        const isSpouse = (node_of_dag.added_data as any).input.is_spouse;

        // 3. Populate Sidebar
        const sidebar = document.getElementById('family-sidebar');
        const titleEl = document.getElementById('sidebar-title');
        const detailsEl = document.getElementById('sidebar-details');
        const imageEl = document.getElementById('sidebar-image') as HTMLImageElement;

        if (!sidebar || !titleEl || !detailsEl || !imageEl) return;

        // Set Title
        titleEl.innerText = name;

        // Set Image or Placeholder
        const imagePath = get_image_path(node_of_dag);
        const placeholder = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

        imageEl.src = (imagePath && imagePath !== "") ? imagePath : placeholder;
        imageEl.style.display = "inline-block";
        imageEl.style.cursor = "pointer";
        imageEl.title = "Fotoğrafı değiştirmek için tıklayın";

        // Clear add child mode flag
        imageEl.dataset.addChildMode = "false";
        imageEl.dataset.addSpouseMode = "false";
        imageEl.dataset.deletePhoto = "false";

        // Show delete photo button if there's an actual photo
        const deletePhotoBtn = document.getElementById('delete-photo-btn');
        if (deletePhotoBtn) {
            if (imagePath && imagePath !== "") {
                deletePhotoBtn.style.display = "block";
                deletePhotoBtn.onclick = (e) => {
                    e.stopPropagation();
                    imageEl.dataset.deletePhoto = "true";
                    imageEl.src = placeholder;
                    deletePhotoBtn.style.display = "none";
                    const statusEl = document.getElementById('save-status');
                    if (statusEl) {
                        statusEl.innerText = "Fotoğraf silinecek (kaydet butonuna basın)";
                        statusEl.style.color = "orange";
                    }
                };
            } else {
                deletePhotoBtn.style.display = "none";
            }
        }

        // Click image to upload
        imageEl.onclick = () => {
            const input = document.getElementById('image-upload-input');
            if (input) input.click();
        };

        // Set Details Form
        const keyMap: any = {
            "first_name": "Ad",
            "last_name": "Soyad",
            "gender": "Cinsiyet",
            "birth_date": "Doğum Tarihi",
            "death_date": "Ölüm Tarihi",
            "birthplace": "Doğum Yeri",
            "occupation": "Meslek",
            "note": "Not",
            "marriage": "Evlilik Tarihi"
        };

        let detailsHtml = "";

        const fieldsToEdit = [
            { key: "first_name", type: "text" },
            { key: "last_name", type: "text" },
            {
                key: "gender", type: "select", options: [
                    { value: "E", label: "Erkek" },
                    { value: "K", label: "Kadın" },
                    { value: "U", label: "Belirsiz" }
                ]
            },
            { key: "birth_date", type: "text" },
            { key: "birthplace", type: "text" },
            { key: "death_date", type: "text" },
            { key: "marriage", type: "text" },
            { key: "note", type: "text" }
        ];

        if (is_member(node_of_dag)) {
            const data = (node_of_dag.added_data as any).input;

            detailsHtml += `<div class="edit-form">`;

            fieldsToEdit.forEach(field => {
                const displayKey = keyMap[field.key] || field.key;
                const value = data[field.key] || "";

                detailsHtml += `<div class="info-row">`;

                if (field.type === "select") {
                    detailsHtml += `<select class="sidebar-input" data-key="${field.key}">
                                <option value="" disabled ${value === "" ? "selected" : ""}>${displayKey}</option>`;
                    (field as any).options.forEach((opt: any) => {
                        const selected = value === opt.value ? 'selected' : '';
                        detailsHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                    });
                    detailsHtml += `</select>`;
                } else {
                    detailsHtml += `<input type="text" class="sidebar-input" data-key="${field.key}" value="${value}" placeholder="${displayKey}">`;
                }

                detailsHtml += `</div>`;
            });

            // Path Finder UI
            detailsHtml += `
            <div class="sidebar-section" style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee;">
                <h4 style="margin-bottom: 10px; font-size: 0.9rem;">En Kısa Yol Bul</h4>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <input type="text" id="path-target-input" class="sidebar-input" list="member-list" placeholder="Hedef kişi ismi..." style="width:100%;">
                    <datalist id="member-list">
                        ${this.dag_all.nodes()
                            .filter(n => is_member(n))
                            .map(n => {
                                const name = get_name(n);
                                const bdate = (n.added_data.input as any).birth_date;
                                let extra = "";
                                if (bdate) extra += ` (d. ${bdate})`;
                                
                                try {
                                    const unions = this.dag_all.parents(n);
                                    if (unions.length > 0) {
                                        const parents = this.dag_all.parents(unions[0]);
                                        const father = parents.find(p => (p.added_data.input as any)?.gender === 'E');
                                        const parentName = father ? get_name(father) : (parents.length > 0 ? get_name(parents[0]) : "");
                                        if (parentName) extra += ` - Baba: ${parentName}`;
                                    }
                                } catch(e) {}

                                let displayValue = `${name}${extra}`;
                                
                                // Handle duplicates by appending counter
                                if (nameToIdMap.has(displayValue)) {
                                    let counter = 2;
                                    while (nameToIdMap.has(`${displayValue} (${counter})`)) {
                                        counter++;
                                    }
                                    displayValue = `${displayValue} (${counter})`;
                                }
                                
                                nameToIdMap.set(displayValue, n.data);
                                return `<option value="${displayValue}">`;
                            })
                            .join('')}
                    </datalist>
                    <button id="btn-find-path" class="action-btn btn-primary" style="width: 100%; padding: 12px;">Bul</button>
                </div>
            </div>`;

            const isLeafNode = Array.from(node_of_dag_all.children!()).length === 0;

            let actionButton = "";
            if (isSpouse) {
                actionButton = `<button id="btn-add-child" class="action-btn btn-primary">👶 Çocuk Ekle</button>`;
            } else {
                actionButton = `<button id="btn-add-spouse" class="action-btn btn-secondary">💍 Eş Ekle</button>`;
            }

            let deleteButton = "";
            if (isLeafNode) {
                deleteButton = `<button id="btn-delete-child" class="action-btn btn-danger">🗑️ Sil</button>`;
            }

            detailsHtml += `
            <div class="button-row" style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; gap:8px; width:100%;">
                    ${actionButton}
                    ${deleteButton}
                </div>
                <div style="display:flex; gap:8px; width:100%; align-items:center;">
                    <button id="btn-save-changes" class="action-btn btn-success" style="flex:1;">💾 Kaydet</button>
                </div>
                <div id="save-status" style="text-align:center; font-size:0.85rem; min-height:1.2em;"></div>
            </div>
        </div>`;

        } else {
            detailsHtml = "<em>Aile Bağlantısı (Düzenlenemez)</em>";
        }
        detailsEl.innerHTML = detailsHtml;

        // Bind Buttons
        const btnSave = document.getElementById('btn-save-changes');
        const btnAddChild = document.getElementById('btn-add-child');
        const btnAddSpouse = document.getElementById('btn-add-spouse');
        const btnDeleteChild = document.getElementById('btn-delete-child');
        const btnFindPath = document.getElementById('btn-find-path');

        if (btnSave) {
            btnSave.onclick = () => {
                const updates: any = {};
                const inputs = detailsEl.querySelectorAll('input.sidebar-input, select.sidebar-input');
                inputs.forEach(inp => {
                    const key = inp.getAttribute('data-key');
                    const val = (inp as HTMLInputElement).value;
                    const original = (node_of_dag.added_data as any).input[key!] || "";

                    if (val !== original) {
                        const colIndex = COLUMN_MAPPING[key!];
                        if (colIndex) updates[colIndex] = val;
                    }
                });

                if (imageEl.dataset.deletePhoto === "true") {
                    updates[COLUMN_MAPPING['image_path']] = "";
                }

                if (Object.keys(updates).length > 0) {
                    saveData(node_of_dag, updates);
                    imageEl.dataset.deletePhoto = "false";
                    const deletePhotoBtn = document.getElementById('delete-photo-btn');
                    if (deletePhotoBtn) deletePhotoBtn.style.display = "none";
                } else {
                    const statusEl = document.getElementById('save-status');
                    if (statusEl) statusEl.innerText = "Değişiklik yok.";
                }
            };
        }

        if (btnAddChild) {
            btnAddChild.onclick = () => {
                showAddChildForm(node_of_dag);
            };
        }

        if (btnAddSpouse) {
            btnAddSpouse.onclick = () => {
                showAddSpouseForm(node_of_dag);
            };
        }

        if (btnDeleteChild) {
            btnDeleteChild.onclick = () => {
                deleteChild(node_of_dag);
            };
        }

        const btnMove = document.createElement("button");
        btnMove.className = "action-btn btn-warning";
        btnMove.innerText = "↔️ Ebeveyn Değiştir";
        btnMove.style.marginTop = "10px";
        btnMove.onclick = () => showMoveChildForm(node_of_dag);

        if (is_member(node_of_dag) && !(node_of_dag.added_data as any).input.is_spouse) {
            const btnRow = detailsEl.querySelector('.button-row');
            if (btnRow) {
                btnRow.appendChild(btnMove);
            }
        }

        const btnSheet = document.getElementById('btn-open-sheet');
        if (btnSheet) {
            const memberData = (node_of_dag.added_data as any).input;
            if (memberData && memberData.row_index) {
                const row = parseInt(memberData.row_index);
                const sheetEditUrl = `https://docs.google.com/spreadsheets/d/12kZlANYbq0w3k8TpDxssVSlWVfbs-qZQ9bAjERci0SM/edit#gid=790197592&range=${row}:${row}`;

                btnSheet.onclick = () => window.open(sheetEditUrl, "_blank");
                btnSheet.innerText = `✏️ Bu Satırı Düzenle (Satır ${row})`;
            } else {
                // Fallback: Just open the sheet without a specific row
                btnSheet.onclick = () => window.open("https://docs.google.com/spreadsheets/d/12kZlANYbq0w3k8TpDxssVSlWVfbs-qZQ9bAjERci0SM/edit?gid=790197592", "_blank");
                btnSheet.innerText = "Google Tablosunu Aç";
            }
        }

        if (btnFindPath) {
            btnFindPath.onclick = () => {
                const input = document.getElementById('path-target-input') as HTMLInputElement;
                const inputValue = input.value;
                if (!inputValue) return;

                const targetId = nameToIdMap.get(inputValue);
                
                if (targetId) {
                    familienbaum.findPath(node_of_dag_all.data, targetId);
                } else {
                    alert("Kişi bulunamadı: " + inputValue);
                }
            };
        }

        sidebar.classList.add('active');
    };

    familienbaum.create_info_form = function () {
        window.open("https://docs.google.com/spreadsheets/d/12kZlANYbq0w3k8TpDxssVSlWVfbs-qZQ9bAjERci0SM/edit?gid=790197592", "_blank");
    };
}