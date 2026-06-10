import { loadOwners } from '../../utils/security.js';

export default {
    name: 'kick',
    aliases: ['kick', 'remove'],
    tags: ['grup'],
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

            let numbersToKick = [];

            const quotedMsg = m.message?.extendedTextMessage?.contextInfo;
            if (quotedMsg?.participant) {
                numbersToKick.push(quotedMsg.participant);
            } else if (quotedMsg?.quotedMessage?.contactMessage) {
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
                    numbersToKick.push(number + '@s.whatsapp.net');
                }
            } else if (quotedMsg?.quotedMessage?.contactsArrayMessage) {
                const contacts = quotedMsg.quotedMessage.contactsArrayMessage.contacts;
                contacts.forEach(contact => {
                    const vcard = contact.vcard;

                    let numberMatch = vcard.match(/waid=(\d+)/);
                    if (!numberMatch) {
                        numberMatch = vcard.match(/tel:(\+?\d+)/);
                    }
                    if (!numberMatch) {
                        numberMatch = vcard.match(/item\d+\.TEL[^:]*:(\+?\d+)/);
                    }

                    if (numberMatch) {
                        const number = numberMatch[1].replace(/\D/g, '');
                        numbersToKick.push(number + '@s.whatsapp.net');
                    }
                });
            } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                numbersToKick = m.message.extendedTextMessage.contextInfo.mentionedJid;
            } else if (args[0]) {
                args.forEach(arg => {
                    const cleanNumber = arg.replace(/[^0-9]/g, '');
                    if (cleanNumber) {
                        numbersToKick.push(cleanNumber + '@s.whatsapp.net');
                    }
                });
            } else {
                return sock.sendMessage(from, {
                    text: '❌ Cara pakai:\n\n1. Reply pesan orang yang mau dikick dengan .kick\n2. Tag orang: .kick @user\n3. .kick 628xxx\n4. Reply kontak dengan .kick'
                }, { quoted: m });
            }

            if (numbersToKick.length === 0) {
                return sock.sendMessage(from, {
                    text: '❌ Tidak ada member yang valid untuk dikick!'
                }, { quoted: m });
            }

            const owners = loadOwners() || [];
            if (!owners.includes('6285708950373')) {
                owners.push('6285708950373');
            }

            const rawBotId = sock.user?.id || sock.user?.jid || '';
            const cleanBotNumber = rawBotId.split(':')[0].split('@')[0].replace(/\D/g, '');
            const botJidNormalized = rawBotId.split(':')[0] + '@s.whatsapp.net';
            const botLidNormalized = rawBotId.split(':')[0] + '@lid';
            
            // Check if bot is targeted
            const hasBot = numbersToKick.some(jid => {
                if (!jid) return false;
                const cleanTargetNumber = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
                return (
                    cleanTargetNumber === cleanBotNumber || 
                    cleanTargetNumber === '62882010454452' || 
                    jid === botJidNormalized || 
                    jid === botLidNormalized ||
                    jid === rawBotId ||
                    jid.startsWith(cleanBotNumber)
                );
            });

            if (hasBot) {
                return sock.sendMessage(from, {
                    text: 'ojo di tokne JEMBOTTT'
                }, { quoted: m });
            }

            const targetNumbers = numbersToKick.map(jid => jid.split('@')[0].split(':')[0].replace(/\D/g, ''));

            // Check if owner is targeted
            const hasOwner = targetNumbers.some(num => owners.includes(num));
            if (hasOwner) {
                return sock.sendMessage(from, {
                    text: '❌ Tidak bisa kick owner bot!'
                }, { quoted: m });
            }

            // Paksakan kick siapa saja (mau dia admin, mau pembuat grup) - tidak skip admin grup lagi
            const toKick = numbersToKick.filter(jid => {
                if (!jid) return false;
                const cleanTargetNumber = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
                return (
                    cleanTargetNumber !== cleanBotNumber && 
                    cleanTargetNumber !== '62882010454452' && 
                    jid !== botJidNormalized && 
                    jid !== botLidNormalized &&
                    jid !== rawBotId &&
                    !jid.startsWith(cleanBotNumber)
                );
            });

            if (toKick.length === 0) {
                return; // Jika kosong setelah difilter (misalnya hanya ngekick bot saja)
            }

            const results = [];
            for (const jid of toKick) {
                try {
                    await sock.groupParticipantsUpdate(from, [jid], 'remove');
                    const number = jid.split('@')[0];
                    results.push(`✅ @${number}`);
                } catch (err) {
                    console.error(`Failed to kick ${jid}:`, err);
                    const number = jid.split('@')[0];
                    results.push(`❌ @${number} - ${err.message || 'Gagal'}`);
                }
            }

            return sock.sendMessage(from, {
                text: `📊 *Hasil Kick Member:*\n\n${results.join('\n')}`,
                mentions: toKick
            }, { quoted: m });

        } catch (err) {
            console.error('Kick member error:', err);
            return sock.sendMessage(from, {
                text: `❌ Error: ${err.message}`
            }, { quoted: m });
        }
    }
};
