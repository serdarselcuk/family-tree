// Helper to clean text
function clean(txt) {
    return (txt || "").toString().trim();
}

function slugify(text) {
    const trMap = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
    };
    return text.split('').map(c => trMap[c] || c).join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
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
    let driveRegex = /drive\.google\.com\/file\/d\/([-_\w]+)/;
    let match = url.match(driveRegex);
    if (match && match[1]) {
        // Use direct Google Content link to avoid 302 redirects
        return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000";
    }
    // Check for "open?id=" style
    driveRegex = /drive\.google\.com\/open\?id=([-_\w]+)/;
    match = url.match(driveRegex);
    if (match && match[1]) {
        return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000";
    }
    return url;
}

// --- HARDCODED COLUMN INDICES (0-based) ---
// These must match your Google Sheet
const COL_GEN = 0;          // A: Generation
const COL_NAME = 1;         // B: Name (Ad)
const COL_SURNAME = 2;      // C: Surname (Soyad)
// COL_FATHER = 3;          // D: Father (Baba) - Structural, not for direct editing
// COL_MOTHER = 4;          // E: Mother (Anne) - Structural, not for direct editing
const COL_BIRTH_DATE = 5;   // F: Birth Date (Doğum Tarihi)
const COL_BIRTHPLACE = 6;   // G: Birth Place (Doğum Yeri)
const COL_DEATH_DATE = 7;   // H: Death Date (Ölüm Tarihi)
const COL_IMAGE_PATH = 8;   // I: Image Path (Resim Yolu)
const COL_MARRIAGE = 9;     // J: Marriage Date (Evlilik Tarihi) - Currently empty in CSV
const COL_GENDER = 10;      // K: Gender (Cinsiyet) - E/K/U (Erkek/Kadın/Unknown)
const COL_NOTE = 11;        // L: Note (Not)


function processSheetData(rows) {
    console.log("Processing " + rows.length + " data rows in Hierarchical Mode with column numbers.");

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
    // This is used to link children to the correct mother (Fallback)
    const spouseMap = {};

    // Maps generation level to a dictionary of Spouse Names -> IDs
    // spouseNameMap[5] = { "Sakine": "mem_16", "Funduka": "mem_17" }
    const spouseNameMap = {};

    // To track duplicates for stable ID generation
    const idCounts = {};

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

    rows.forEach((row, index) => {
        if (row.length === 0 || clean(row[COL_GEN]) === "") return;

        const rawGen = row[COL_GEN];
        const genType = parseGen(rawGen);

        if (genType === null && rawGen === "") return;

        const firstName = clean(row[COL_NAME]);
        const lastName = clean(row[COL_SURNAME]);
        const birthDate = clean(row[COL_BIRTH_DATE]);

        // Generate Stable ID
        let baseId = slugify(firstName + "_" + lastName);
        if (birthDate) {
            // Try to extract year 4 digits
            const yearMatch = birthDate.match(/\d{4}/);
            if (yearMatch) baseId += "_" + yearMatch[0];
            else baseId += "_" + slugify(birthDate);
        }

        if (!baseId) baseId = "unknown";

        let stableId = "mem_" + baseId;

        // Handle duplicates
        if (idCounts[stableId]) {
            idCounts[stableId]++;
            stableId += "_" + idCounts[stableId];
        } else {
            idCounts[stableId] = 1;
        }

        const id = stableId;

        let fullName = firstName;
        if (lastName) fullName += " " + lastName;
        if (!fullName) fullName = "Unknown";

        const imgRaw = clean(row[COL_IMAGE_PATH]);
        const img = convertDriveLink(imgRaw.replace(/\\/g, "/"));

        // Read Parent Names for linking
        const fatherNameData = clean(row[3]); // Col D: Father Name
        const motherNameData = clean(row[4]); // Col E: Mother Name

        members[id] = {
            "id": id,
            "name": fullName,
            "first_name": firstName,
            "last_name": lastName,
            "birth_date": clean(row[COL_BIRTH_DATE]),
            "birthplace": clean(row[COL_BIRTHPLACE]),
            "death_date": clean(row[COL_DEATH_DATE]),
            "image_path": img,
            "marriage": clean(row[COL_MARRIAGE]),
            "note": clean(row[COL_NOTE]),
            "gender": clean(row[COL_GENDER]) || "U", // M/F/U (Male/Female/Unknown)
            "gen": null,
            "is_spouse": (genType === "E")
        };

        // LOGIC for linking and generation
        if (genType === "E") {
            // This is a Spouse
            if (!lastRegularMember) {
                console.warn("Row " + (index + 2) + ": Spouse 'E' found but no partner exists above.");
                return;
            }

            const partnerID = lastRegularMember;
            const partnerGen = lastRegularMemberGen;

            members[id].gen = partnerGen;

            spouseMap[partnerGen] = id; // Set as last seen spouse

            // Add to Name Map
            if (!spouseNameMap[partnerGen]) spouseNameMap[partnerGen] = {};
            spouseNameMap[partnerGen][firstName] = id; // Map "Sakine" -> ID

            getUnion(partnerID, id);

        } else {
            // This is a Child (Numeric Gen)
            const gen = genType;
            members[id].gen = gen;

            lastRegularMember = id;
            lastRegularMemberGen = gen;
            genMap[gen] = id;
            spouseMap[gen] = null; // Reset last spouse
            spouseNameMap[gen] = {}; // Reset spouse name map for this new person

            // Find Parent
            if (gen > 1) {
                const parentID = genMap[gen - 1];
                let spouseID = null;

                // Try to match father name to a spouse
                if (fatherNameData && spouseNameMap[gen - 1] && spouseNameMap[gen - 1][fatherNameData]) {
                    spouseID = spouseNameMap[gen - 1][fatherNameData];
                }
                // Try to match mother name to a spouse
                else if (motherNameData && spouseNameMap[gen - 1] && spouseNameMap[gen - 1][motherNameData]) {
                    spouseID = spouseNameMap[gen - 1][motherNameData];
                }
                // Fallback to last seen spouse
                else {
                    spouseID = spouseMap[gen - 1];
                }

                if (parentID) {
                    const uID = getUnion(parentID, spouseID);
                    links.push([uID, id]);
                }
            } else {
                console.warn("Row " + (index + 2) + ": Gen " + gen + " found but no parent at Gen " + (gen - 1));
            }
        }
    });

    // Determine Start Node (First Gen 1)
    const startID = Object.keys(members)[0];

    return {
        "start": startID,
        "members": members,
        "links": links
    };
}

async function loadFromGoogleSheet(url) {
    const cacheKey = "soyagaci_data_" + slugify(url);
    try {
        // Use d3.text to get raw CSV content
        const rawText = await d3.text(url);

        // Parse the entire CSV structure first
        const allRows = d3.csvParseRows(rawText);

        if (!allRows || allRows.length <= 1) throw new Error("No data rows found.");

        // Skip the header row (index 0)
        const dataRows = allRows.slice(1);

        const processed = processSheetData(dataRows);
        console.log("Graph built:", processed);
        
        try {
            localStorage.setItem(cacheKey, JSON.stringify(processed));
        } catch (e) {
            console.warn("Failed to save to cache", e);
        }
        
        return processed;
    } catch (error) {
        console.warn("Network failed, trying cache...", error);
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
        
        console.error("Error loading sheet:", error);
        alert("Error loading data. Check console.");
        throw error;
    }
}