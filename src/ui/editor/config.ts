export const UPLOAD_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz98JrPFb1xW84pirJKMHlsvDJ5c2msxsVDTYvwKpm498twobAOhVuEfNrvWtzUI3LV/exec";

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
    "note": 12,          // L: Not
    "gender": 11         // K: Cinsiyet (M/F/U)
};
