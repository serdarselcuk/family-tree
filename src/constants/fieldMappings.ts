/**
 * Field name mappings for multi-language support (German/English)
 * Used to access member data with either German or English field names
 */

export const FIELD_MAPPINGS = {
    /** Person's full name */
    name: ["Name", "name"],

    /** Additional names (middle names) */
    secondNames: ["Zweitnamen", "second_names"],

    /** Birth date */
    birthDate: ["Geburtstag", "birth_date"],

    /** Death date */
    deathDate: ["Todestag", "death_date"],

    /** Place of birth */
    birthPlace: ["Geburtsort", "birth_place"],

    /** Place of death */
    deathPlace: ["Todesort", "death_place"],

    /** Marriage date/info */
    marriage: ["Hochzeit", "marriage"],

    /** Occupation/profession */
    occupation: ["Beruf", "occupation"],

    /** Additional notes */
    note: ["Notiz", "note"],

    /** Profile image path */
    imagePath: ["image_path"],
} as const;

// Type-safe access to field mappings
export type FieldMappings = typeof FIELD_MAPPINGS;
