// Helper to clean text
function clean(txt) {
    return (txt || "").toString().trim();
}

// Helper to parse the generation/id column
function parseGen(val) {
    const s = clean(val).toUpperCase();
    if (s === "E") return "E";
    const n = parseInt(s, 10);
    return isNaN(n) ? null : n;
}

// Helper to convert Drive links
function convertDriveLink(url) {
    if (!url) return "";
    // Check for basic Drive file link
    let driveRegex = /drive\.google\.com\/file\/d\/([-_Wc]+)/;
    let match = url.match(driveRegex);
    if (match && match[1]) {
        return "https://drive.google.com/uc?export=view&id=" + match[1];
    }
    // Check for "open?id=" style
    driveRegex = /drive\.google\.com\/open\?id=([-_Wc]+)/;
    match = url.match(driveRegex);
    if (match && match[1]) {
        return "https://drive.google.com/uc?export=view&id=" + match[1];
    }
    return url;
}

function processSheetData(data) {
    console.log("Processing " + data.length + " rows in Hierarchical Mode.");
    
    const members = {};
    const links = [];
    const unions = {}; // Key: "p1_p2", Value: unionID

    // State for hierarchical parsing
    let lastRegularMember = null; // The last person processed who has a numeric gen
    let lastRegularMemberGen = 0; 
    
    // Maps generation level to the *active* parent ID at that level
    // e.g., genMap[1] = "GrandpaID"
    const genMap = {}; 
    
    // Maps generation level to the *active* spouse ID at that level (if any)
    // This is used to link children to the correct mother
    const spouseMap = {};

    // Helper to create/get union
    function getUnion(p1, p2) {
        const uKey = [p1, p2 || "unknown"].sort().join("_");
        if (!unions[uKey]) {
            const uID = "u_" + uKey;
            unions[uKey] = uID;
            if (members[p1]) links.push([p1, uID]);
            if (p2 && members[p2]) links.push([p2, uID]);
        }
        return unions[uKey];
    }

    data.forEach((row, index) => {
        // Auto-generate ID if missing
        // We assume column 'id' might be the generation column now?
        // User said "First column is generation id".
        // D3 CSV parsing uses the header row keys.
        // We need to find which key corresponds to the first column.
        // Heuristic: Look for keys like "Gen", "Nesil", "Generation", or just the first key.
        
        const keys = Object.keys(row);
        if (keys.length === 0) return;
        
        // Assume first column is Generation
        const genKey = keys[0]; 
        const rawGen = row[genKey];
        const genType = parseGen(rawGen);

        if (genType === null && rawGen === "") return; // Skip empty rows

        // Construct Member Object
        // We try to find columns by name, falling back to loose matching
        function getCol(keywords) {
            for (let k of keys) {
                const lower = k.toLowerCase();
                for (let kw of keywords) {
                    if (lower.includes(kw)) return row[k];
                }
            }
            return "";
        }

        // Unique ID for this person (row based to be safe)
        const id = "mem_" + index;
        
        let name = getCol(["name", "isim", "ad soyad", "ad-soyad"]);
        if (!name) {
            // Try split columns
            const firstName = getCol(["adı", "adi", "first name", "ad"]);
            const lastName = getCol(["soyadı", "soyadi", "last name", "soyad"]);
            if (firstName) {
                name = firstName + (lastName ? " " + lastName : "");
            } else {
                name = "Unknown";
            }
        }

        const imgRaw = getCol(["resim yolu", "image", "foto", "img", "resim"]);
        const img = convertDriveLink(clean(imgRaw).replace(/\\/g, "/"));
        
        members[id] = {
            "id": id,
            "name": name,
            "birth_date": getCol(["birth_date", "dogum", "doğum"]),
            "death_date": getCol(["death", "olum", "ölüm"]),
            "birthplace": getCol(["place", "yer"]),
            "image_path": img,
            // Preserve other fields if needed
            "note": getCol(["note", "not"]),
            "occupation": getCol(["occupation", "is", "iş", "meslek"])
        };

        // LOGIC
        if (genType === "E") {
            // This is a Spouse
            if (!lastRegularMember) {
                console.warn("Row " + index + ": Spouse 'E' found but no partner exists above.");
                return;
            }
            
            // Link to the last regular member (Partner)
            // We assume E is spouse of the person at the same level?
            // "spouse of the last non-E person above them"
            
            const partnerID = lastRegularMember;
            const partnerGen = lastRegularMemberGen;
            
            // Register as current spouse for this generation level
            spouseMap[partnerGen] = id;
            
            // Create union immediately to show partnership
            getUnion(partnerID, id);
            
        } else {
            // This is a Child (Numeric Gen)
            const gen = genType;
            
            // Update state
            lastRegularMember = id;
            lastRegularMemberGen = gen;
            genMap[gen] = id;
            spouseMap[gen] = null; // Reset spouse for this new person
            
            // Find Parent
            // Child at Gen N has parent at Gen N-1
            if (gen > 1) {
                const fatherID = genMap[gen - 1];
                const motherID = spouseMap[gen - 1]; // The last spouse recorded at that level
                
                if (fatherID) {
                    const uID = getUnion(fatherID, motherID);
                    links.push([uID, id]);
                } else {
                    console.warn("Row " + index + ": Gen " + gen + " found but no parent at Gen " + (gen-1));
                }
            }
        }
    });
    
    // Determine Start Node (First Gen 1)
    // Or just the first member
    const startID = Object.keys(members)[0];

    return {
        "start": startID,
        "members": members,
        "links": links
    };
}

async function loadFromGoogleSheet(url) {
    try {
        const data = await d3.csv(url);
        if (!data || data.length === 0) throw new Error("No data found.");
        
        const processed = processSheetData(data);
        console.log("Graph built:", processed);
        return processed;
    } catch (error) {
        console.error("Error loading sheet:", error);
        alert("Error loading data. Check console.");
        throw error;
    }
}