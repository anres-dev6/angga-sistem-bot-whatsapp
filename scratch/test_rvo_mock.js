// Mock test script to verify recursive findMediaMessage parser in RVO command
const TARGET_MEDIA_TYPES = [
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'ephemeralMessage',
    'imageMessage',
    'videoMessage',
    'documentMessage',
    'stickerMessage'
];

function findMediaMessage(obj, path = 'quoted') {
    if (!obj || typeof obj !== 'object') return null;

    // 1. Precedence check on current object layer
    for (const type of TARGET_MEDIA_TYPES) {
        if (obj[type]) {
            const nested = obj[type];
            const currentPath = `${path} -> ${type}`;
            
            if (['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'ephemeralMessage'].includes(type)) {
                const subMsg = nested.message || nested;
                const result = findMediaMessage(subMsg, currentPath);
                if (result) return result;
            } else {
                if (nested.mediaKey || nested.directPath || nested.url) {
                    return {
                        type,
                        message: nested,
                        path: currentPath
                    };
                }
            }
        }
    }

    // 2. Deep recursive fallback search
    for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === 'object' && key !== 'contextInfo') {
            const result = findMediaMessage(obj[key], `${path} -> ${key}`);
            if (result) return result;
        }
    }

    return null;
}

// ----------------------------------------------------
// Mock Data Structs
// ----------------------------------------------------

const mockCases = [
    {
        name: "Standard iOS Quoted View Once Photo",
        data: {
            viewOnceMessage: {
                message: {
                    imageMessage: {
                        mediaKey: "ios_key_abc",
                        mimetype: "image/jpeg",
                        caption: "hello ios view once"
                    }
                }
            }
        }
    },
    {
        name: "Nested Ephemeral + View Once V2 Video (Android / Business)",
        data: {
            ephemeralMessage: {
                message: {
                    viewOnceMessageV2: {
                        message: {
                            videoMessage: {
                                mediaKey: "android_key_123",
                                mimetype: "video/mp4",
                                caption: "nested ephemeral rvo video"
                            }
                        }
                    }
                }
            }
        }
    },
    {
        name: "Forwarded Status documentMessage wrapped in contextInfo properties",
        data: {
            contextInfo: {
                quotedMessage: {
                    // Standard nesting fallback scan
                }
            },
            someForwarderWrapper: {
                documentMessage: {
                    mediaKey: "doc_key_xyz",
                    mimetype: "application/pdf",
                    fileName: "document.pdf"
                }
            }
        }
    },
    {
        name: "Invalid missing mediaKey data",
        data: {
            imageMessage: {
                caption: "expired or corrupted image without download key"
            }
        }
    }
];

// ----------------------------------------------------
// Run tests
// ----------------------------------------------------
console.log("=== RUNNING RVO RECURSIVE PARSER SIMULATION ===");
for (const tc of mockCases) {
    console.log(`\nTesting case: "${tc.name}"`);
    const result = findMediaMessage(tc.data);
    if (result) {
        console.log(`✅ MATCH SUCCESS!`);
        console.log(`  - Type: ${result.type}`);
        console.log(`  - Path resolved: ${result.path}`);
        console.log(`  - Caption: ${result.message.caption || '-'}`);
        console.log(`  - MediaKey: ${result.message.mediaKey || '-'}`);
    } else {
        console.log(`❌ NO COMPATIBLE MEDIA DETECTED (Graceful fallback fallback).`);
    }
}
