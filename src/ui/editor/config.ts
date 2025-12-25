export const UPLOAD_SCRIPT_URL = "https://docs.google.com/spreadsheets/d/1FFzX_ywTR39bLTCDtFCLyjFYl9IZYdL3PkoLZjKUyOs/edit?usp=drivesdk";

// --- HARDCODED COLUMN MAPPING (1-based indices for Google Sheet) ---
export const COLUMN_MAPPING: { [key: string]: number } = {
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
    "gender": 11,        // K: Cinsiyet (M/F/U)
    "note": 12,          // L: Not
    "id": 13             // M: ID
};
