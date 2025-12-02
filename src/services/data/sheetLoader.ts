import * as d3 from 'd3';
import { z } from 'zod';
import { FamilyData, Member } from '../../types/types';

// --- Zod Schemas ---

const GenderSchema = z.enum(['E', 'K', 'U']).default('U');

// Schema for a processed member object (internal use)
const MemberSchema = z.object({
    id: z.string(),
    name: z.string(),
    first_name: z.string(),
    last_name: z.string().optional(),
    birth_date: z.string().optional(),
    birthplace: z.string().optional(),
    death_date: z.string().optional(),
    image_path: z.string().optional(),
    marriage: z.string().optional(),
    note: z.string().optional(),
    gender: GenderSchema,
    gen: z.number().optional(),
    is_spouse: z.boolean(),
});

// --- Constants ---
const COL_GEN = 0;
const COL_NAME = 1;
const COL_SURNAME = 2;
const COL_FATHER = 3;
const COL_MOTHER = 4;
const COL_BIRTH_DATE = 5;
const COL_BIRTHPLACE = 6;
const COL_DEATH_DATE = 7;
const COL_IMAGE_PATH = 8;
const COL_MARRIAGE = 9;
const COL_GENDER = 10;
const COL_NOTE = 11;

// --- Helpers ---

function clean(txt: any): string {
    return (txt || "").toString().trim();
}

function parseGen(val: any): number | "E" | null {
    const s = clean(val).toUpperCase();
    if (s === "E") return "E";
    const n = parseInt(s, 10);
    return isNaN(n) ? null : n;
}

function convertDriveLink(url: string): string {
    if (!url) return "";
    let driveRegex = /drive\.google\.com\/file\/d\/([-_\w]+)/;
    let match = url.match(driveRegex);
    if (match && match[1]) return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000";

    driveRegex = /drive\.google\.com\/open\?id=([-_\w]+)/;
    match = url.match(driveRegex);
    if (match && match[1]) return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000";

    return url;
}

export function processSheetData(rows: string[][]): FamilyData {
    console.log("Processing " + rows.length + " data rows with Zod validation.");

    const members: { [key: string]: Member } = {};
    const links: Array<[string, string]> = [];
    const unions: { [key: string]: string } = {};

    let lastRegularMember: string | null = null;
    let lastRegularMemberGen = 0;
    const genMap: { [key: number]: string } = {};
    const spouseMap: { [key: number]: string | null } = {};
    const spouseNameMap: { [key: number]: { [key: string]: string } } = {};

    function getUnion(p1: string, p2: string | null) {
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
        // Basic row validation
        if (row.length === 0 || clean(row[COL_GEN]) === "") return;

        const rawGen = row[COL_GEN];
        const genType = parseGen(rawGen);
        if (genType === null && rawGen === "") return;

        const id = "mem_" + index;
        const firstName = clean(row[COL_NAME]);
        const lastName = clean(row[COL_SURNAME]);
        let fullName = firstName;
        if (lastName) fullName += " " + lastName;
        if (!fullName) fullName = "Unknown";

        const img = convertDriveLink(clean(row[COL_IMAGE_PATH]).replace(/\\/g, "/"));

        // Construct raw member object
        const rawMember = {
            id,
            name: fullName,
            first_name: firstName,
            last_name: lastName || undefined,
            birth_date: clean(row[COL_BIRTH_DATE]) || undefined,
            birthplace: clean(row[COL_BIRTHPLACE]) || undefined,
            death_date: clean(row[COL_DEATH_DATE]) || undefined,
            image_path: img || undefined,
            marriage: clean(row[COL_MARRIAGE]) || undefined,
            note: clean(row[COL_NOTE]) || undefined,
            gender: (clean(row[COL_GENDER]) as any) || "U",
            gen: undefined, // Placeholder
            is_spouse: (genType === "E")
        };

        // Validate with Zod
        const result = MemberSchema.safeParse(rawMember);

        if (!result.success) {
            console.warn(`Row ${index + 2}: Validation failed`, result.error.format());
            // We can choose to skip or use a fallback. For now, we'll try to use what we have but log it.
            // In a strict mode, we might want to skip.
        }

        // Use the validated data or fall back to raw (if partial failure is acceptable)
        // For now, we trust our construction but Zod helps catch unexpected types if we change logic.
        members[id] = rawMember as Member;

        // Logic for linking (same as before, but cleaner)
        const fatherNameData = clean(row[COL_FATHER]);
        const motherNameData = clean(row[COL_MOTHER]);

        if (genType === "E") {
            if (!lastRegularMember) {
                console.warn("Row " + (index + 2) + ": Spouse 'E' found but no partner exists above.");
                return;
            }
            const partnerID = lastRegularMember;
            const partnerGen = lastRegularMemberGen;
            members[id].gen = partnerGen;
            spouseMap[partnerGen] = id;
            if (!spouseNameMap[partnerGen]) spouseNameMap[partnerGen] = {};
            spouseNameMap[partnerGen][firstName] = id;
            getUnion(partnerID, id);
        } else {
            const gen = genType as number;
            members[id].gen = gen;
            lastRegularMember = id;
            lastRegularMemberGen = gen;
            genMap[gen] = id;
            spouseMap[gen] = null;
            spouseNameMap[gen] = {};

            if (gen > 1) {
                const parentID = genMap[gen - 1];
                let spouseID: string | null = null;
                if (fatherNameData && spouseNameMap[gen - 1]?.[fatherNameData]) {
                    spouseID = spouseNameMap[gen - 1][fatherNameData];
                } else if (motherNameData && spouseNameMap[gen - 1]?.[motherNameData]) {
                    spouseID = spouseNameMap[gen - 1][motherNameData];
                } else {
                    spouseID = spouseMap[gen - 1];
                }

                if (parentID) {
                    const uID = getUnion(parentID, spouseID);
                    links.push([uID, id]);
                }
            }
        }
    });

    const startID = Object.keys(members)[0];
    return { start: startID, members, links };
}

export async function loadFromGoogleSheet(url: string): Promise<FamilyData> {
    try {
        const rawText = await d3.text(url);
        const allRows = d3.csvParseRows(rawText);
        if (!allRows || allRows.length <= 1) throw new Error("No data rows found.");
        const dataRows = allRows.slice(1);
        const processed = processSheetData(dataRows);
        console.log("Graph built:", processed);
        return processed;
    } catch (error) {
        console.error("Error loading sheet:", error);
        alert("Error loading data. Check console.");
        throw error;
    }
}
