import { proto, initAuthCreds, BufferJSON } from 'baileys';

// Global connection caches
let pgPool = null;
let mongoClient = null;
let mongoDb = null;

// Initialize connection based on environment variables
async function getDbConnection() {
    // 1. PostgreSQL check
    if (process.env.DATABASE_URL) {
        if (pgPool) return { type: 'postgres', client: pgPool };
        
        try {
            const pg = await import('pg');
            const { Pool } = pg.default;
            
            console.log('[AuthDB] Connecting to PostgreSQL database...');
            pgPool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.DATABASE_URL.includes('sslmode=') ? undefined : { rejectUnauthorized: false },
                connectionTimeoutMillis: 5000 // 5 seconds timeout
            });
            
            // Test connection and initialize table
            await pgPool.query(`
                CREATE TABLE IF NOT EXISTS baileys_auth (
                    session_id VARCHAR(255) NOT NULL,
                    file_id VARCHAR(255) NOT NULL,
                    data JSONB NOT NULL,
                    PRIMARY KEY (session_id, file_id)
                );
            `);
            
            console.log('[AuthDB] PostgreSQL connected & initialized successfully!');
            return { type: 'postgres', client: pgPool };
        } catch (e) {
            console.error('[AuthDB] PostgreSQL Connection/Init Error:', e);
            pgPool = null;
            throw e;
        }
    }
    
    // 2. MongoDB check
    const mongoUrl = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
    if (mongoUrl) {
        if (mongoClient && mongoDb) return { type: 'mongo', db: mongoDb };
        
        try {
            const mongodb = await import('mongodb');
            const { MongoClient } = mongodb.default;
            
            console.log('[AuthDB] Connecting to MongoDB database...');
            mongoClient = new MongoClient(mongoUrl, {
                connectTimeoutMS: 5000,           // 5 seconds timeout
                serverSelectionTimeoutMS: 5000   // 5 seconds timeout
            });
            await mongoClient.connect();
            mongoDb = mongoClient.db();
            
            console.log('[AuthDB] MongoDB connected successfully!');
            return { type: 'mongo', db: mongoDb };
        } catch (e) {
            console.error('[AuthDB] MongoDB Connection Error:', e);
            mongoClient = null;
            mongoDb = null;
            throw e;
        }
    }
    
    return { type: 'none' };
}

// Database helper operations
async function readDbData(sessionId, fileId) {
    const conn = await getDbConnection();
    
    if (conn.type === 'postgres') {
        const res = await conn.client.query(
            'SELECT data FROM baileys_auth WHERE session_id = $1 AND file_id = $2',
            [sessionId, fileId]
        );
        if (res.rows.length === 0) return null;
        const rawJson = JSON.stringify(res.rows[0].data);
        return JSON.parse(rawJson, BufferJSON.reviver);
    }
    
    if (conn.type === 'mongo') {
        const doc = await conn.db.collection('baileys_auth').findOne({ _id: `${sessionId}:${fileId}` });
        if (!doc) return null;
        const rawJson = JSON.stringify(doc.data);
        return JSON.parse(rawJson, BufferJSON.reviver);
    }
    
    return null;
}

async function writeDbData(sessionId, fileId, data) {
    const conn = await getDbConnection();
    const serialized = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
    
    if (conn.type === 'postgres') {
        await conn.client.query(
            `INSERT INTO baileys_auth (session_id, file_id, data) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (session_id, file_id) 
             DO UPDATE SET data = EXCLUDED.data`,
            [sessionId, fileId, serialized]
        );
        return true;
    }
    
    if (conn.type === 'mongo') {
        await conn.db.collection('baileys_auth').replaceOne(
            { _id: `${sessionId}:${fileId}` },
            { _id: `${sessionId}:${fileId}`, session_id: sessionId, file_id: fileId, data: serialized },
            { upsert: true }
        );
        return true;
    }
    
    return false;
}

async function removeDbData(sessionId, fileId) {
    const conn = await getDbConnection();
    
    if (conn.type === 'postgres') {
        await conn.client.query(
            'DELETE FROM baileys_auth WHERE session_id = $1 AND file_id = $2',
            [sessionId, fileId]
        );
        return true;
    }
    
    if (conn.type === 'mongo') {
        await conn.db.collection('baileys_auth').deleteOne({ _id: `${sessionId}:${fileId}` });
        return true;
    }
    
    return false;
}

/**
 * Custom Baileys auth state provider that stores credentials in database
 * @param {string} sessionId - The session identifier (e.g. 'main', or JID)
 * @returns {Promise<object|null>} Auth state object, or null if no DB environment variables are set
 */
export async function getDatabaseAuthState(sessionId) {
    const conn = await getDbConnection();
    if (conn.type === 'none') {
        console.log('[AuthDB] No database URL detected. Falling back to local file storage.');
        return null;
    }
    
    // Clean session ID to be safe
    const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    // Load credentials from database or initialize if new
    let creds = await readDbData(cleanSessionId, 'creds.json');
    if (!creds) {
        console.log(`[AuthDB] Creating new credentials for session: ${cleanSessionId}`);
        creds = initAuthCreds();
        await writeDbData(cleanSessionId, 'creds.json', creds);
    } else {
        console.log(`[AuthDB] Loaded existing credentials for session: ${cleanSessionId}`);
    }
    
    const state = {
        creds,
        keys: {
            get: async (type, ids) => {
                const data = {};
                for (const id of ids) {
                    let value = await readDbData(cleanSessionId, `${type}-${id}.json`);
                    if (type === 'app-state-sync-key' && value) {
                        value = proto.Message.AppStateSyncKeyData.fromObject(value);
                    }
                    data[id] = value;
                }
                return data;
            },
            set: async (data) => {
                for (const category in data) {
                    for (const id in data[category]) {
                        const value = data[category][id];
                        const file = `${category}-${id}.json`;
                        if (value) {
                            await writeDbData(cleanSessionId, file, value);
                        } else {
                            await removeDbData(cleanSessionId, file);
                        }
                    }
                }
            }
        }
    };
    
    return {
        state,
        saveCreds: async () => {
            await writeDbData(cleanSessionId, 'creds.json', state.creds);
        }
    };
}

/**
 * Check if a session exists in the database
 * @param {string} sessionId - The session identifier
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
export async function hasDatabaseSession(sessionId) {
    const conn = await getDbConnection();
    if (conn.type === 'none') return false;
    
    const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const creds = await readDbData(cleanSessionId, 'creds.json');
    return !!creds;
}

/**
 * Clear a session from the database (e.g. on manual logout)
 * @param {string} sessionId - The session identifier
 * @returns {Promise<boolean>} True if cleared, false otherwise
 */
export async function clearDatabaseSession(sessionId) {
    const conn = await getDbConnection();
    if (conn.type === 'none') return false;
    
    const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    if (conn.type === 'postgres') {
        await conn.client.query('DELETE FROM baileys_auth WHERE session_id = $1', [cleanSessionId]);
        return true;
    }
    
    if (conn.type === 'mongo') {
        await conn.db.collection('baileys_auth').deleteMany({ session_id: cleanSessionId });
        return true;
    }
    
    return false;
}
