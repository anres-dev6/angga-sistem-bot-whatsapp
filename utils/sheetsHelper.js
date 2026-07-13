import { google } from 'googleapis';
import { BufferJSON } from 'baileys';

// Cache auth client and sheet instance
let sheetsInstance = null;

// Get Google Sheets client
function getSheetsClient() {
    if (sheetsInstance) return sheetsInstance;

    try {
        const credsEnv = process.env.GOOGLE_CREDENTIALS;
        if (!credsEnv) {
            throw new Error('GOOGLE_CREDENTIALS environment variable is not defined.');
        }

        // Parse GOOGLE_CREDENTIALS safely (handling double escapes or stringified formatting)
        let credentials;
        try {
            credentials = JSON.parse(credsEnv);
        } catch (parseErr) {
            // Fallback for double escaped characters (like newlines) in some environments
            const cleaned = credsEnv.replace(/\\n/g, '\n');
            credentials = JSON.parse(cleaned);
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        sheetsInstance = google.sheets({ version: 'v4', auth });
        return sheetsInstance;
    } catch (err) {
        console.error('[Google Sheets] Auth initialization failed:', err);
        throw err;
    }
}

const spreadsheetId = process.env.SPREADSHEET_ID || "14ecwKryEKVD7xXSTLplXXYrX28qzCB6uizJ2Gsx-TY4";

/**
 * Ensures a sheet tab for the specified year exists. Creates it with formatted headers if not.
 * @param {string} sheetName - The sheet tab name (usually the current year, e.g. "2026")
 * @returns {Promise<number>} The sheetId of the tab
 */
export async function ensureSheet(sheetName) {
    const sheets = getSheetsClient();
    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
    
    let sheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
    
    if (!sheet) {
        console.log(`[Google Sheets] Sheet "${sheetName}" not found. Creating it...`);
        
        // 1. Add new sheet
        const addResponse = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }
                ]
            }
        });
        
        const sheetId = addResponse.data.replies[0].addSheet.properties.sheetId;
        
        // 2. Set headers
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1:E1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [["Waktu", "Bulan", "Tipe", "Keterangan", "Nominal"]]
            }
        });
        
        // 3. Format headers (Bold, background Hex #1F4E78, white text, borders)
        // RGB components for #1F4E78: red = 31/255 = 0.1215, green = 78/255 = 0.3058, blue = 120/255 = 0.4705
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: 5
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: {
                                        red: 31 / 255,
                                        green: 78 / 255,
                                        blue: 120 / 255
                                    },
                                    textFormat: {
                                        bold: true,
                                        foregroundColor: {
                                            red: 1.0,
                                            green: 1.0,
                                            blue: 1.0
                                        }
                                    },
                                    borders: {
                                        top: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                                        bottom: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                                        left: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                                        right: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } }
                                    },
                                    horizontalAlignment: 'CENTER'
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat,borders,horizontalAlignment)'
                        }
                    }
                ]
            }
        });
        
        return sheetId;
    }
    
    return sheet.properties.sheetId;
}

const MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/**
 * Record a new finance transaction row
 * @param {string} type - "Pengeluaran", "Pemasukan", "Nabung", or "Ambil Tabungan"
 * @param {number} nominal - Transaction amount
 * @param {string} keterangan - Description
 */
export async function recordTransaction(type, nominal, keterangan) {
    const sheets = getSheetsClient();
    
    // Get current date time in Jakarta Timezone
    const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const formatter = new Intl.DateTimeFormat('id-ID', options);
    const parts = formatter.formatToParts(new Date());
    
    // Extract year and month name
    const year = parts.find(p => p.type === 'year').value;
    const monthNum = parseInt(parts.find(p => p.type === 'month').value) - 1;
    const monthName = MONTHS_ID[monthNum];
    const timestampStr = formatter.format(new Date());
    
    // 1. Ensure sheet for this year exists
    const sheetId = await ensureSheet(year);
    
    // 2. Append row
    const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${year}!A:E`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [[timestampStr, monthName, type, keterangan, nominal]]
        }
    });
    
    // 3. Format row with border and column E with currency format
    const updatedRange = response.data.updates.updatedRange; // e.g. "2026!A10:E10"
    const rowMatch = updatedRange.match(/A(\d+):E(\d+)/);
    
    if (rowMatch) {
        const rowIndex = parseInt(rowMatch[1]) - 1; // 0-indexed for batchUpdate
        
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [
                    {
                        // Add border to columns A to E for the new row
                        repeatCell: {
                            range: {
                                sheetId,
                                startRowIndex: rowIndex,
                                endRowIndex: rowIndex + 1,
                                startColumnIndex: 0,
                                endColumnIndex: 5
                            },
                            cell: {
                                userEnteredFormat: {
                                    borders: {
                                        top: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                                        bottom: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                                        left: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                                        right: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } }
                                    }
                                }
                            },
                            fields: 'userEnteredFormat.borders'
                        }
                    },
                    {
                        // Set number format to Rp#,##0 for column E (Nominal)
                        repeatCell: {
                            range: {
                                sheetId,
                                startRowIndex: rowIndex,
                                endRowIndex: rowIndex + 1,
                                startColumnIndex: 4, // Column E (0-indexed 4)
                                endColumnIndex: 5
                            },
                            cell: {
                                userEnteredFormat: {
                                    numberFormat: {
                                        type: 'CURRENCY',
                                        pattern: '"Rp"#,##0'
                                    }
                                }
                            },
                            fields: 'userEnteredFormat.numberFormat'
                        }
                    }
                ]
            }
        });
    }
    
    return { timestamp: timestampStr, month: monthName };
}

/**
 * Retrieve finance summaries for the current month and year
 * @returns {Promise<object>} Summary details containing pengeluaran, nabung, and sisa saldo tabungan
 */
export async function getFinanceSummary() {
    const sheets = getSheetsClient();
    
    const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'numeric' };
    const formatter = new Intl.DateTimeFormat('id-ID', options);
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year').value;
    const monthNum = parseInt(parts.find(p => p.type === 'month').value) - 1;
    const currentMonthName = MONTHS_ID[monthNum];
    
    // Ensure sheet exists (creates it if not found, but if it doesn't exist, totals will be 0)
    await ensureSheet(year);
    
    // Read all values from A2:E (skipping header)
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${year}!A2:E`
    });
    
    const rows = response.data.values || [];
    
    let pengeluaranBulanIni = 0;
    let nabungBulanIni = 0;
    let totalNabung = 0;
    let totalAmbilTabungan = 0;
    
    for (const row of rows) {
        // row columns: 0 (Waktu), 1 (Bulan), 2 (Tipe), 3 (Keterangan), 4 (Nominal)
        if (row.length < 5) continue;
        
        const bulan = row[1];
        const tipe = row[2];
        // Remove Rp and separators if sheets returned formatted values, parse as number
        const nominal = parseFloat(row[4]?.toString().replace(/[^\d\-]/g, '')) || 0;
        
        if (tipe === 'Pengeluaran') {
            if (bulan === currentMonthName) {
                pengeluaranBulanIni += nominal;
            }
        } else if (tipe === 'Nabung') {
            totalNabung += nominal;
            if (bulan === currentMonthName) {
                nabungBulanIni += nominal;
            }
        } else if (tipe === 'Ambil Tabungan') {
            totalAmbilTabungan += nominal;
        }
    }
    
    const sisaTabungan = totalNabung - totalAmbilTabungan;
    
    return {
        pengeluaranBulanIni,
        nabungBulanIni,
        sisaTabungan,
        currentMonthName,
        year
    };
}
