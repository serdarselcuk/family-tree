// Redefined editor.js to work with the Static Sidebar
// It no longer creates DOM elements, but populates existing ones.

const UPLOAD_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz98JrPFb1xW84pirJKMHlsvDJ5c2msxsVDTYvwKpm498twobAOhVuEfNrvWtzUI3LV/exec";

let currentEditedNode = null;
let pendingChildPhoto = null; // Store photo file when adding a new child

// --- HARDCODED COLUMN MAPPING (1-based indices for Google Sheet) ---
const COLUMN_MAPPING = {
    "gen_col": 1,        // A: Generation
    "first_name": 2,     // B: Ad
    "last_name": 3,      // C: Soyad
    "father": 4,         // D: Baba (structural, not editable here)
    "mother": 5,         // E: Anne (structural, not editable here)
    "birth_date": 6,     // F: Doğum Tarihi
    "birthplace": 7,     // G: Doğum Yeri
    "death_date": 8,     // H: Ölüm Tarihi
    "image_path": 9,     // I: Resim Yolu
    "marriage": 10,      // J: Evlilik Tarihi
    "note": 11,          // K: Not
    "gender": 12         // L: Cinsiyet (M/F/U)
};

// Function to convert file to Base64
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data URI prefix
        reader.onerror = error => reject(error);
    });
}

async function saveData(node, updates) {
    const statusEl = document.getElementById('save-status');
    statusEl.innerText = "Kaydediliyor...";
    statusEl.style.color = "orange";

    try {
        const memberId = parseInt(node.data.split("_")[1]);
        // sheetRow is 1-based, matches row in Google Sheet
        const sheetRow = memberId + 2;

        const payload = {
            row: sheetRow,
            updates: updates
        };

        await fetch(UPLOAD_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        // Optimistic Update: Update local data and UI immediately
        if (!node.added_data.input) node.added_data.input = {};
        for (const [key, val] of Object.entries(updates)) {
            // key here is the 1-based column index (e.g., "2" for first_name)
            // We need to map it back to the property name (e.g., "first_name")
            const propName = Object.keys(COLUMN_MAPPING).find(prop => COLUMN_MAPPING[prop] == parseInt(key));
            if (propName) {
                node.added_data.input[propName] = val;
            }
        }

        // Reconstruct Full Name for display if first_name or last_name changed
        if (updates[COLUMN_MAPPING['first_name']] !== undefined || updates[COLUMN_MAPPING['last_name']] !== undefined) {
            const f = node.added_data.input['first_name'] || "";
            const l = node.added_data.input['last_name'] || "";
            node.added_data.input['name'] = (f + " " + l).trim();

            // Update Sidebar Title
            document.getElementById('sidebar-title').innerText = node.added_data.input['name'];
        }

        // Update tree node image if photo was deleted
        if (updates[COLUMN_MAPPING['image_path']] === "") {
            if (typeof d3 !== 'undefined') {
                d3.selectAll("g.node")
                    .filter(d => d.data === node.data)
                    .select("image")
                    .attr("href", "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png");
            }
        }

        // Refresh UI elements (Name in tree, etc.)
        if (typeof d3 !== 'undefined') {
            d3.selectAll("g.node")
                .filter(d => d.data === node.data)
                .select("text") // Update label if name changed
                .each(function (d) { set_multiline(d3.select(this.parentNode), d, true); });
        }

        statusEl.innerText = "Kaydedildi! (Kalıcı olması 5-10 dk sürebilir)";
        statusEl.style.color = "green";
        setTimeout(() => statusEl.innerText = "", 5000);

    } catch (e) {
        console.error(e);
        statusEl.innerText = "Hata: " + e.message;
        statusEl.style.color = "red";
    }
}

async function addSpouse(node) {
    showAddSpouseForm(node);
}

// Helper to render form fields (reused for Edit and Add)
function renderFormFields(container, data) {
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
    fieldsToEdit.forEach(field => {
        const value = data[field.key] || "";

        html += `<div class="info-row">`;

        if (field.type === "select") {
            html += `<select class="sidebar-input" data-key="${field.key}">
                        <option value="" disabled ${value === "" ? "selected" : ""}>${field.label}</option>`;
            field.options.forEach(opt => {
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

function showAddChildForm(node) {
    const sidebar = document.getElementById('family-sidebar');
    const titleEl = document.getElementById('sidebar-title');
    const detailsEl = document.getElementById('sidebar-details');
    const imageEl = document.getElementById('sidebar-image');

    // Show placeholder image for new child
    const placeholder = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
    imageEl.src = placeholder;
    imageEl.style.display = "inline-block";
    imageEl.style.cursor = "pointer";
    imageEl.title = "Fotoğraf eklemek için tıklayın";

    // Reset pending photo
    pendingChildPhoto = null;

    // Clear upload status from previous operations (if any)
    const statusEl = document.getElementById('save-status');
    if (statusEl) statusEl.innerText = "";

    // Hide delete photo button (no photo yet for new child)
    const deletePhotoBtn = document.getElementById('delete-photo-btn');
    deletePhotoBtn.style.display = "none";

    // Set a flag that we're in "add child" mode
    imageEl.dataset.addChildMode = "true";
    imageEl.dataset.deletePhoto = "false";

    // Click image to select photo (use normal flow with cropper)
    imageEl.onclick = () => {
        document.getElementById('image-upload-input').click();
    };

    // Set Title
    titleEl.innerText = "Yeni Çocuk Ekle";

    // Pre-fill Data
    const parentSurname = node.added_data.input.last_name || "";
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
            document.getElementById('family-sidebar').classList.remove('active');
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

function showAddSpouseForm(node) {
    const sidebar = document.getElementById('family-sidebar');
    const titleEl = document.getElementById('sidebar-title');
    const detailsEl = document.getElementById('sidebar-details');
    const imageEl = document.getElementById('sidebar-image');

    // Show placeholder image for new spouse
    const placeholder = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
    imageEl.src = placeholder;
    imageEl.style.display = "inline-block";
    imageEl.style.cursor = "pointer";
    imageEl.title = "Fotoğraf eklemek için tıklayın";

    // Reset pending photo (spouses don't have this for now, but keep structure)
    pendingChildPhoto = null; // Renaming this variable might be good in the future

    // Clear upload status from previous operations (if any)
    const statusEl = document.getElementById('save-status');
    if (statusEl) statusEl.innerText = "";

    // Hide delete photo button (no photo yet for new spouse)
    const deletePhotoBtn = document.getElementById('delete-photo-btn');
    deletePhotoBtn.style.display = "none";

    // Set a flag that we're in "add spouse" mode
    imageEl.dataset.addSpouseMode = "true"; // New flag for spouse
    imageEl.dataset.deletePhoto = "false";

    // Click image to select photo (use normal flow with cropper)
    imageEl.onclick = () => {
        document.getElementById('image-upload-input').click();
    };

    // Set Title
    titleEl.innerText = "Yeni Eş Ekle";

    // Pre-fill Data
    const spouseSurname = node.added_data.input.last_name || ""; // Spouse takes same surname initially
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
            document.getElementById('family-sidebar').classList.remove('active');
        }
    };

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "action-btn btn-success";
    btnConfirm.innerText = "✅ Eşi Ekle";
    btnConfirm.onclick = () => submitNewSpouse(node); // New submit function for spouse

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



async function submitNewChild(node) {
    const statusEl = document.getElementById('add-status');
    const memberId = parseInt(node.data.split("_")[1]);

    // 1. Collect Data
    const inputs = document.querySelectorAll('#sidebar-details input.sidebar-input');
    const updates = {};
    let hasName = false;

    inputs.forEach(inp => {
        const key = inp.getAttribute('data-key');
        const val = inp.value;
        if (val) {
            if (key === 'first_name') hasName = true;
            const colIndex = COLUMN_MAPPING[key];
            if (colIndex) updates[colIndex] = val;
        }
    });

    if (!hasName) {
        alert("Lütfen en azından bir isim (Ad) girin.");
        return;
    }

    // 2. Calculate Anchor & Parents (Same logic as before)
    let anchorId = memberId;
    const isClickedNodeSpouse = node.added_data.input.is_spouse;

    if (isClickedNodeSpouse && window.familyData && window.familyData.members) {
        let tempId = memberId;
        while (tempId >= 0) {
            const m = window.familyData.members["mem_" + tempId];
            if (!m) break;
            if (!m.is_spouse) {
                anchorId = tempId;
                break;
            }
            tempId--;
        }
    }

    const anchorNode = window.familyData.members["mem_" + anchorId];
    const anchorGen = anchorNode.gen;

    // 3. Calculate Insertion Point
    let lastFamilyIndex = anchorId;
    let checkId = anchorId + 1;

    if (window.familyData && window.familyData.members) {
        while (true) {
            const nextMem = window.familyData.members["mem_" + checkId];
            if (!nextMem) break;

            if (nextMem.is_spouse) {
                lastFamilyIndex = checkId;
                checkId++;
                continue;
            }

            if (nextMem.gen > anchorGen) {
                lastFamilyIndex = checkId;
                checkId++;
                continue;
            }
            break;
        }
    }

    const insertAfterRow = lastFamilyIndex + 2;
    const childGen = anchorGen + 1;

    // 4. Add System Fields to Updates
    updates[COLUMN_MAPPING['gen_col']] = childGen;

    // Determine mother and father based on gender
    const anchorGender = anchorNode.gender || 'E';  // Default to E (Erkek) if not specified
    const clickedGender = node.added_data.input.gender || (isClickedNodeSpouse ? 'K' : 'E');

    // Assign father and mother based on actual genders
    if (isClickedNodeSpouse) {
        // Both anchor and clicked node are parents
        if (anchorGender === 'E') {
            updates[COLUMN_MAPPING['father']] = anchorNode.first_name;
            updates[COLUMN_MAPPING['mother']] = node.added_data.input.first_name;
        } else {
            updates[COLUMN_MAPPING['father']] = node.added_data.input.first_name;
            updates[COLUMN_MAPPING['mother']] = anchorNode.first_name;
        }
    } else {
        // Only anchor node, clicked node is non-spouse
        if (anchorGender === 'E') {
            updates[COLUMN_MAPPING['father']] = anchorNode.first_name;
        } else {
            updates[COLUMN_MAPPING['mother']] = anchorNode.first_name;
        }
    }

    // 5. Send Request
    statusEl.innerText = "Ekleniyor...";
    statusEl.style.color = "orange";

    try {
        const payload = {
            action: "addChild",
            row: insertAfterRow,
            updates: updates // Send full map
        };

        await fetch(UPLOAD_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        statusEl.innerText = "Çocuk eklendi!";
        statusEl.style.color = "green";

        // If a photo was selected, upload it now
        if (pendingChildPhoto) {
            statusEl.innerText = "Çocuk eklendi! Fotoğraf yükleniyor...";
            statusEl.style.color = "orange";

            try {
                // Create a temporary node object for the new child
                // The new child row is at insertAfterRow + 1 (because insertRowsAfter inserts AFTER the specified row)
                // Member ID = row - 2 (to account for 1-based indexing and header row)
                const newChildRow = insertAfterRow + 1;
                const newChildMemberId = newChildRow - 2;
                const tempNode = {
                    data: "mem_" + newChildMemberId,
                    added_data: { input: {} }
                };

                // Upload the photo
                await uploadPhoto(pendingChildPhoto, tempNode);

                statusEl.innerText = "Başarılı! Fotoğraf yüklendi. Sayfayı yenileyin.";
                statusEl.style.color = "green";
                alert("Çocuk ve fotoğraf eklendi. Lütfen sayfayı yenileyin.");

            } catch (photoError) {
                console.error("Photo upload error:", photoError);
                statusEl.innerText = "Çocuk eklendi ama fotoğraf yüklenemedi. Sayfayı yenileyip tekrar deneyin.";
                statusEl.style.color = "orange";
                alert("Çocuk eklendi ama fotoğraf yüklenemedi. Lütfen sayfayı yenileyip fotoğrafı tekrar ekleyin.");
            }

            // Clear pending photo and flag
            pendingChildPhoto = null;
            document.getElementById('sidebar-image').dataset.addChildMode = "false";
        } else {
            statusEl.innerText = "Başarılı! Sayfayı yenileyin.";
            statusEl.style.color = "green";
            alert("Çocuk eklendi. Lütfen sayfayı yenileyin.");
        }

        // Clear the add child mode flag
        document.getElementById('sidebar-image').dataset.addChildMode = "false";

        // Close sidebar after a delay to let user see the message
        setTimeout(() => {
            document.getElementById('family-sidebar').classList.remove('active');
        }, 1000);

    } catch (e) {
        console.error(e);
        statusEl.innerText = "Hata: " + e.message;
        statusEl.style.color = "red";
    }
}

async function submitNewSpouse(node) {
    const statusEl = document.getElementById('add-status');
    const memberId = parseInt(node.data.split("_")[1]);

    // 1. Collect Data
    const inputs = document.querySelectorAll('#sidebar-details input.sidebar-input, #sidebar-details select.sidebar-input');
    const updates = {};
    let hasName = false;

    inputs.forEach(inp => {
        const key = inp.getAttribute('data-key');
        const val = inp.value;
        if (val) {
            if (key === 'first_name') hasName = true;
            const colIndex = COLUMN_MAPPING[key];
            if (colIndex) updates[colIndex] = val;
        }
    });

    if (!hasName) {
        alert("Lütfen en azından bir isim (Ad) girin.");
        return;
    }

    // 2. Calculate Insertion Point (Same logic as in original addSpouse)
    let insertAfterRow = memberId; // Default: After self
    let checkId = memberId + 1;

    if (window.familyData && window.familyData.members) {
        while (true) {
            const nextMem = window.familyData.members["mem_" + checkId];
            if (!nextMem) break;

            if (nextMem.is_spouse) {
                insertAfterRow = checkId;
                checkId++;
                continue;
            }

            break; // Stop before children or next family
        }
    }

    const targetRow = insertAfterRow + 2; // +2 for 1-based indexing and header row

    // 3. Add System Fields to Updates
    updates[COLUMN_MAPPING['gen_col']] = "E"; // Spouse generation is 'E'
    updates[COLUMN_MAPPING['father']] = ""; // Spouses do not have father/mother in this context
    updates[COLUMN_MAPPING['mother']] = "";

    // IMPORTANT: Spouses must be marked as `is_spouse` for filtering logic
    updates[COLUMN_MAPPING['note']] = (updates[COLUMN_MAPPING['note']] ? updates[COLUMN_MAPPING['note']] + ", " : "") + "is_spouse:true";

    // 4. Send Request
    statusEl.innerText = "Ekleniyor...";
    statusEl.style.color = "orange";

    try {
        const payload = {
            action: "addSpouse",
            row: targetRow,
            updates: updates // Send full map
        };

        await fetch(UPLOAD_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        statusEl.innerText = "Eş eklendi!";
        statusEl.style.color = "green";

        // Handle photo upload (if any)
        const imageEl = document.getElementById('sidebar-image');
        const isAddSpouseMode = imageEl.dataset.addSpouseMode === "true"; // Check our new flag

        if (isAddSpouseMode && pendingChildPhoto) { // pendingChildPhoto is misused here, but contains the file
            statusEl.innerText = "Eş eklendi! Fotoğraf yükleniyor...";
            statusEl.style.color = "orange";

            try {
                // Determine the new spouse's member ID
                // The new spouse row is at targetRow (insertRowsAfter inserts AFTER the specified row, so the new row is targetRow itself if we passed insertAfterRow + 2 as targetRow, which we did)
                // Member ID = row - 2
                const newSpouseMemberId = targetRow - 2;
                const tempNode = {
                    data: "mem_" + newSpouseMemberId,
                    added_data: { input: {} }
                };

                await uploadPhoto(pendingChildPhoto, tempNode);

                statusEl.innerText = "Başarılı! Fotoğraf yüklendi. Sayfayı yenileyin.";
                statusEl.style.color = "green";
                alert("Eş ve fotoğraf eklendi. Lütfen sayfayı yenileyin.");

            } catch (photoError) {
                console.error("Photo upload error:", photoError);
                statusEl.innerText = "Eş eklendi ama fotoğraf yüklenemedi. Sayfayı yenileyip tekrar deneyin.";
                statusEl.style.color = "orange";
                alert("Eş eklendi ama fotoğraf yüklenemedi. Lütfen sayfayı yenileyip fotoğrafı tekrar ekleyin.");
            }
            pendingChildPhoto = null;
            imageEl.dataset.addSpouseMode = "false";
        } else {
            statusEl.innerText = "Başarılı! Sayfayı yenileyin.";
            statusEl.style.color = "green";
            alert("Eş eklendi. Lütfen sayfayı yenileyin.");
        }

        imageEl.dataset.addSpouseMode = "false"; // Clear the add spouse mode flag

        setTimeout(() => {
            document.getElementById('family-sidebar').classList.remove('active');
        }, 1000);

    } catch (e) {
        console.error(e);
        statusEl.innerText = "Hata: " + e.message;
        statusEl.style.color = "red";
    }
}

async function addChild(node) {
    showAddChildForm(node);
}

async function deleteChild(node) {
    const name = get_name(node) || "Bu kişi";
    const confirmDelete = confirm(`${name} isimli kişiyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`);

    if (!confirmDelete) return;

    try {
        const memberId = parseInt(node.data.split("_")[1]);
        const sheetRow = memberId + 2; // +2 for 1-based indexing and header row

        const statusEl = document.getElementById('save-status');
        statusEl.innerText = "Siliniyor...";
        statusEl.style.color = "orange";

        const payload = {
            action: "deleteRow",
            row: sheetRow
        };

        await fetch(UPLOAD_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        statusEl.innerText = "Silindi! Sayfayı yenileyin.";
        statusEl.style.color = "green";
        alert("Kişi silindi. Lütfen sayfayı yenileyin.");

        // Close sidebar after a delay
        setTimeout(() => {
            document.getElementById('family-sidebar').classList.remove('active');
        }, 1000);

    } catch (e) {
        console.error(e);
        const statusEl = document.getElementById('save-status');
        statusEl.innerText = "Hata: " + e.message;
        statusEl.style.color = "red";
    }
}


// Function to handle the actual upload
// Function to handle the actual upload
async function uploadPhoto(file, node) {
    const statusEl = document.getElementById('save-status'); // Use save-status instead
    const sidebarImage = document.getElementById('sidebar-image');

    if (statusEl) {
        statusEl.innerText = "Yükleniyor...";
        statusEl.style.color = "orange";
    }

    try {
        if (!node || !node.data.startsWith("mem_")) {
            throw new Error("Lütfen fotoğraf yüklemek için bir kişi seçin.");
        }

        const base64Data = await getBase64(file);
        const memberId = parseInt(node.data.split("_")[1]); // Extract member index from "mem_X"
        const sheetRow = memberId + 2; // +2 for 1-based indexing and header row

        const payload = {
            fileName: file.name,
            mimeType: file.type,
            fileData: base64Data,
            row: sheetRow,
            colIndex: COLUMN_MAPPING["image_path"] || 9 // Use hardcoded index
        };

        const response = await fetch(UPLOAD_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Use no-cors to avoid CORS errors, response will be opaque
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(payload)
        });

        // Optimistic UI Update
        const temporaryImageUrl = URL.createObjectURL(file);

        // 1. Update Sidebar Image
        sidebarImage.src = temporaryImageUrl;
        sidebarImage.style.display = "inline-block";

        // 2. Update Node Data
        node.added_data.input.image_path = temporaryImageUrl;

        // 3. Update Tree Node Image
        if (typeof d3 !== 'undefined') {
            d3.selectAll("g.node")
                .filter(d => d.data === node.data)
                .select("image")
                .attr("href", temporaryImageUrl);
        }

        if (statusEl) {
            statusEl.innerText = "Yüklendi! (Kalıcı olması 5-10 dk sürebilir)";
            statusEl.style.color = "green";
            setTimeout(() => {
                statusEl.innerText = "";
            }, 5000);
        }

    } catch (error) {
        console.error("Fotoğraf yüklenirken hata oluştu:", error);
        if (statusEl) {
            statusEl.innerText = `Hata: ${error.message}`;
            statusEl.style.color = "red";
        } else {
            alert(`Hata: ${error.message}`);
        }
    } finally {
        // Clear the file input after upload attempt
        document.getElementById('image-upload-input').value = '';
    }
}


Familienbaum.prototype.create_editing_form = function (node_of_dag, node_of_dag_all) {
    currentEditedNode = node_of_dag; // Store the currently edited node

    // 1. Update Tree View (Expand/Highlight)
    for (let node of this.get_relationship_in_dag_all(node_of_dag_all))
        node.added_data.is_visible = true;
    this.draw(true, node_of_dag_all.data);

    // 2. Get Data
    let name = get_name(node_of_dag) || "İsimsiz"; // This is the combined display name
    const isSpouse = node_of_dag.added_data.input.is_spouse;

    // 3. Populate Sidebar
    const sidebar = document.getElementById('family-sidebar');
    const titleEl = document.getElementById('sidebar-title');
    const detailsEl = document.getElementById('sidebar-details');
    const imageEl = document.getElementById('sidebar-image');
    const btnParents = document.getElementById('btn-parents');
    const btnChildren = document.getElementById('btn-children');

    // Set Title (Static, just the combined name)
    titleEl.innerText = name;

    // Set Image or Placeholder
    const imagePath = get_image_path(node_of_dag);
    const placeholder = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

    imageEl.src = (imagePath && imagePath !== "") ? imagePath : placeholder;
    imageEl.style.display = "inline-block";
    imageEl.style.cursor = "pointer";
    imageEl.title = "Fotoğrafı değiştirmek için tıklayın";

    // Clear add child mode flag (we're in edit mode now)
    imageEl.dataset.addChildMode = "false";
    imageEl.dataset.deletePhoto = "false";

    // Show delete photo button if there's an actual photo (not placeholder)
    const deletePhotoBtn = document.getElementById('delete-photo-btn');
    if (imagePath && imagePath !== "") {
        deletePhotoBtn.style.display = "block";
        deletePhotoBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent triggering image upload
            // Mark photo for deletion
            imageEl.dataset.deletePhoto = "true";
            // Show placeholder
            imageEl.src = placeholder;
            // Hide delete button
            deletePhotoBtn.style.display = "none";
            // Show status
            document.getElementById('save-status').innerText = "Fotoğraf silinecek (kaydet butonuna basın)";
            document.getElementById('save-status').style.color = "orange";
        };
    } else {
        deletePhotoBtn.style.display = "none";
    }

    // Click image to upload
    imageEl.onclick = () => {
        document.getElementById('image-upload-input').click();
    };

    // Set Details Form
    const keyMap = {
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

    // Define fields to edit from the new COLUMN_MAPPING
    // Use the actual property names from the node.added_data.input object
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
        const data = node_of_dag.added_data.input;

        // Build Form Inputs
        detailsHtml += `<div class="edit-form">`;

        fieldsToEdit.forEach(field => {
            const displayKey = keyMap[field.key] || field.key;
            const value = data[field.key] || "";

            detailsHtml += `<div class="info-row">`;

            if (field.type === "select") {
                detailsHtml += `<select class="sidebar-input" data-key="${field.key}">
                                <option value="" disabled ${value === "" ? "selected" : ""}>${displayKey}</option>`;
                field.options.forEach(opt => {
                    const selected = value === opt.value ? 'selected' : '';
                    detailsHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                });
                detailsHtml += `</select>`;
            } else {
                detailsHtml += `<input type="text" class="sidebar-input" data-key="${field.key}" value="${value}" placeholder="${displayKey}">`;
            }

            detailsHtml += `</div>`;
        });

        // Check if this is a leaf node (no children)
        const isLeafNode = Array.from(node_of_dag_all.children()).length === 0;

        // Add Save and Dynamic Add Button
        let actionButton = "";
        if (isSpouse) {
            actionButton = `<button id="btn-add-child" class="action-btn btn-primary">👶 Çocuk Ekle</button>`;
        } else {
            actionButton = `<button id="btn-add-spouse" class="action-btn btn-secondary">💍 Eş Ekle</button>`;
        }

        // Add delete button for leaf nodes
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

    if (btnSave) {
        btnSave.onclick = () => {
            const updates = {};

            // Get both input and select elements
            const inputs = detailsEl.querySelectorAll('input.sidebar-input, select.sidebar-input');
            inputs.forEach(inp => {
                const key = inp.getAttribute('data-key'); // e.g., "first_name"
                const val = inp.value;
                const original = node_of_dag.added_data.input[key] || "";

                if (val !== original) {
                    const colIndex = COLUMN_MAPPING[key]; // Get 1-based column index
                    if (colIndex) updates[colIndex] = val;
                }
            });

            // Check if photo is marked for deletion
            if (imageEl.dataset.deletePhoto === "true") {
                updates[COLUMN_MAPPING['image_path']] = ""; // Clear the image path
            }

            if (Object.keys(updates).length > 0) {
                saveData(node_of_dag, updates);
                // Clear deletion flag after save
                imageEl.dataset.deletePhoto = "false";
                const deletePhotoBtn = document.getElementById('delete-photo-btn');
                if (deletePhotoBtn) deletePhotoBtn.style.display = "none";
            } else {
                document.getElementById('save-status').innerText = "Değişiklik yok.";
            }
        };
    }

    if (btnAddChild) {
        btnAddChild.onclick = () => {
            addChild(node_of_dag);
        };
    }

    if (btnAddSpouse) {
        btnAddSpouse.onclick = () => {
            addSpouse(node_of_dag);
        };
    }

    if (btnDeleteChild) {
        btnDeleteChild.onclick = () => {
            deleteChild(node_of_dag);
        };
    }

    // Bind Actions to Buttons
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

    // Update "Open Google Sheet" button to link to specific row
    const btnSheet = document.getElementById('btn-open-sheet');
    if (btnSheet) {
        if (node_of_dag.data.startsWith("mem_")) {
            const idx = parseInt(node_of_dag.data.split("_")[1]);
            const row = idx + 2;
            const sheetEditUrl = `https://docs.google.com/spreadsheets/d/12kZlANYbq0w3k8TpDxssVSlWVfbs-qZQ9bAjERci0SM/edit#gid=790197592&range=A${row}`;

            btnSheet.onclick = () => window.open(sheetEditUrl, "_blank");
            btnSheet.innerText = `✏️ Bu Satırı Düzenle (Satır ${row})`;
        } else {
            // Default behavior for non-row nodes
            btnSheet.onclick = () => window.open("https://docs.google.com/spreadsheets/d/12kZlANYbq0w3k8TpDxssVSlWVfbs-qZQ9bAjERci0SM/edit?gid=790197592", "_blank");
            btnSheet.innerText = "Google Tablosunu Aç";
        }
    }

    // 4. Show Sidebar
    sidebar.classList.add('active');
}

Familienbaum.prototype.create_info_form = function () {
    // For the 'i' button, we can just open the sidebar with generic info or an alert
    // or open the sheet directly.
    // Let's open the sheet directly for simplicity as per user preference for robustness.
    window.open("https://docs.google.com/spreadsheets/d/12kZlANYbq0w3k8TpDxssVSlWVfbs-qZQ9bAjERci0SM/edit?gid=790197592", "_blank");
}

// Add event listeners for the new upload elements
let cropper = null;

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('image-upload-input');
    const cropModal = document.getElementById('crop-modal');
    const cropImage = document.getElementById('image-to-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const btnConfirmCrop = document.getElementById('btn-confirm-crop');

    // Helper to close modal
    const closeCropModal = () => {
        cropModal.style.display = "none";
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        fileInput.value = ""; // Reset input
    };

    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                const file = event.target.files[0];

                // Read file to display in cropper
                const reader = new FileReader();
                reader.onload = (e) => {
                    cropImage.src = e.target.result;
                    cropModal.style.display = "flex"; // Show modal

                    // Init Cropper
                    if (cropper) cropper.destroy();
                    cropper = new Cropper(cropImage, {
                        aspectRatio: 1, // Square crop usually best for profiles
                        viewMode: 1,
                        autoCropArea: 0.8,
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (btnCancelCrop) {
        btnCancelCrop.addEventListener('click', closeCropModal);
    }

    if (btnConfirmCrop) {
        btnConfirmCrop.addEventListener('click', () => {
            if (!cropper) return;

            // Get cropped canvas
            cropper.getCroppedCanvas({
                width: 400, // Resize to reasonable size
                height: 400
            }).toBlob((blob) => {
                // Create a "File" object from the blob to pass to uploadPhoto
                // We need to preserve the name roughly or give a new one
                const file = new File([blob], "cropped_image.jpg", { type: "image/jpeg" });

                const imageEl = document.getElementById('sidebar-image');
                const isAddChildMode = imageEl.dataset.addChildMode === "true";
                const isAddSpouseMode = imageEl.dataset.addSpouseMode === "true"; // New check for spouse mode

                if (isAddChildMode || isAddSpouseMode) { // Check for either add child or add spouse mode
                    // Store cropped file for later upload after child/spouse is created
                    pendingChildPhoto = file; // Still using pendingChildPhoto, consider renaming for clarity

                    // Show preview in sidebar
                    const tempUrl = URL.createObjectURL(file);
                    imageEl.src = tempUrl;

                    // Update upload status
                    const uploadStatus = document.getElementById('add-status'); // Use add-status
                    if (uploadStatus) { // Check if element exists
                        uploadStatus.innerText = `Fotoğraf hazır (${isAddChildMode ? "çocuk" : "eş"} eklendikten sonra yüklenecek)`;
                        uploadStatus.style.color = "blue";
                    }
                } else if (currentEditedNode) {
                    // Normal edit mode: upload immediately
                    uploadPhoto(file, currentEditedNode);
                }
                closeCropModal();
            }, 'image/jpeg', 0.9);
        });
    }
});