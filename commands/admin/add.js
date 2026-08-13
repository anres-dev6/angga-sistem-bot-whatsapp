export default {
    name: 'add',
    aliases: ['add', 'addmember'],
    tags: ['admin', 'grup'],
    description: 'Tambah member ke grup',
    access: {
        owner: false,
        group: true,
        private: false
    },

    run: async (sock, msg, args, { sender, isOwner }) => {
        const from = msg.key.remoteJid;
        const m = msg;

        try {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;

            const isAdmin = participants.find(p => p.id === sender)?.admin;

            if (!isOwner && !isAdmin) {
                return sock.sendMessage(from, {
                    text: '❌ Command ini hanya untuk admin grup!'
                }, { quoted: m });
            }

            let numbersToAdd = [];

            const quotedMsg = m.message?.extendedTextMessage?.contextInfo;

            if (quotedMsg?.quotedMessage?.contactMessage) {
                const vcard = quotedMsg.quotedMessage.contactMessage.vcard;

                let numberMatch = vcard.match(/waid=(\d+)/);
                if (!numberMatch) {
                    numberMatch = vcard.match(/tel:(\+?\d+)/);
                }
                if (!numberMatch) {
                    numberMatch = vcard.match(/item\d+\.TEL[^:]*:(\+?\d+)/);
                }

                if (numberMatch) {
                    const number = numberMatch[1].replace(/\D/g, '');
                    numbersToAdd.push(number);
                }
            } else if (quotedMsg?.quotedMessage?.contactsArrayMessage) {
                // Multiple contacts
                const contacts = quotedMsg.quotedMessage.contactsArrayMessage.contacts;

                contacts.forEach(contact => {
                    const vcard = contact.vcard;

                    // Try multiple patterns
                    let numberMatch = vcard.match(/waid=(\d+)/);
                    if (!numberMatch) {
                        numberMatch = vcard.match(/tel:(\+?\d+)/);
                    }
                    if (!numberMatch) {
                        numberMatch = vcard.match(/item\d+\.TEL[^:]*:(\+?\d+)/);
                    }

                    if (numberMatch) {
                        const number = numberMatch[1].replace(/\D/g, '');
                        numbersToAdd.push(number);
                    }
                });
            } else if (args[0]) {
                // Manual number input
                args.forEach(arg => {
                    const cleanNumber = arg.replace(/[^0-9]/g, '');
                    if (cleanNumber) {
                        numbersToAdd.push(cleanNumber);
                    }
                });
            } else {
                return sock.sendMessage(from, {
                    text: '❌ Cara pakai:\n\n1. Reply kontak dengan .add\n2. .add 628xxx\n3. .add 628xxx 628yyy (multiple)'
                }, { quoted: m });
            }

            if (numbersToAdd.length === 0) {
                return sock.sendMessage(from, {
                    text: '❌ Tidak ada nomor yang valid!\n\n💡 Coba reply kontak atau ketik nomor manual.'
                }, { quoted: m });
            }

            // Send processing reaction
            await sock.sendMessage(from, {
                react: { text: '⏳', key: m.key }
            });

            // Add members with better status handling
            const results = [];
            for (const number of numbersToAdd) {
                try {
                    const jid = number + '@s.whatsapp.net';
                    const res = await sock.groupParticipantsUpdate(from, [jid], 'add');

                    const status = res?.[0]?.status;

                    if (status === '200' || status === 200) {
                        results.push(`✅ @${number} - Berhasil ditambahkan`);
                    } else if (status === '403' || status === 403) {
                        results.push(`❌ @${number} - Privacy settings / Belum chat bot`);
                    } else if (status === '409' || status === 409) {
                        results.push(`⚠️ @${number} - Sudah ada di grup`);
                    } else {
                        results.push(`⚠️ @${number} - Invite terkirim`);
                    }
                } catch (err) {
                    console.error(`Failed to add ${number}:`, err);

                    if (err.message?.includes('not-authorized')) {
                        results.push(`❌ @${number} - Bot bukan admin`);
                    } else {
                        results.push(`❌ @${number} - Gagal`);
                    }
                }
            }

            // Send success reaction
            await sock.sendMessage(from, {
                react: { text: '✅', key: m.key }
            });

            // Create mentions array
            const mentions = numbersToAdd.map(num => num + '@s.whatsapp.net');

            return sock.sendMessage(from, {
                text: `📊 *Hasil Add Member:*\n\n${results.join('\n')}`,
                mentions: mentions
            }, { quoted: m });

        } catch (err) {
            console.error('Add member error:', err);

            await sock.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });

            return sock.sendMessage(from, {
                text: `❌ Error: ${err.message}`
            }, { quoted: m });
        }
    }
};
