import fetch from 'node-fetch';

// Global state for cerdas cermat game
if (!global.cerdasGame) {
    global.cerdasGame = {};
}

export default {
    name: 'cerdas',
    aliases: ['cerdas', 'cermat', 'cc'],
    tags: ['game'],
    description: 'Main game cerdas cermat multiplayer (quiz)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m, args) => {
        const from = m.key.remoteJid;

        try {
            // Show help menu if no arguments or 'menu' argument
            if (!args[0] || args[0].toLowerCase() === 'menu') {
                return sock.sendMessage(from, {
                    text: `🎓 *CERDAS CERMAT MULTIPLAYER*\n\n` +
                        `📚 *Mata Pelajaran:*\n` +
                        `• matematika / mtk - Soal matematika\n` +
                        `• ipa - Soal IPA\n` +
                        `• ips - Soal IPS\n` +
                        `• pkn - Soal PKN\n` +
                        `• random - Random semua mapel\n\n` +
                        `🎮 *Cara Main:*\n` +
                        `.cerdas [mapel] [jumlah]\n\n` +
                        `📝 *Contoh:*\n` +
                        `• .cerdas mtk 5\n` +
                        `• .cerdas random 10\n\n` +
                        `⚙️ *Aturan:*\n` +
                        `• Jumlah soal: 1-10\n` +
                        `• Timer: 15 detik per soal\n` +
                        `• Multiplayer: semua bisa ikut!\n` +
                        `• Ketik huruf jawaban (a/b/c/d)\n\n` +
                        `🏆 *Leaderboard di akhir!*`
                }, { quoted: m });
            }

            // Check if there's already an active game
            if (global.cerdasGame[from]) {
                return sock.sendMessage(from, {
                    text: "⚠️ Masih ada game yang sedang berjalan!\n\nIkut aja jawab soalnya! 🎮"
                }, { quoted: m });
            }

            // Parse arguments (no defaults - require explicit input)
            let mapel = args[0]?.toLowerCase();
            const jumlah = parseInt(args[1]) || 5;

            // Handle aliases
            const aliases = {
                'mtk': 'matematika'
            };
            if (aliases[mapel]) {
                mapel = aliases[mapel];
            }

            // Handle random
            if (mapel === 'random') {
                const subjects = ['matematika', 'ipa', 'ips', 'pkn'];
                mapel = subjects[Math.floor(Math.random() * subjects.length)];
            }

            // Validate subject
            const validMapel = ['matematika', 'ipa', 'ips', 'pkn'];
            if (!mapel || !validMapel.includes(mapel)) {
                return sock.sendMessage(from, {
                    text: `❌ Mata pelajaran tidak valid!\n\n` +
                        `📚 *Mapel yang tersedia:*\n` +
                        `• matematika / mtk\n` +
                        `• ipa\n` +
                        `• ips\n` +
                        `• pkn\n` +
                        `• random\n\n` +
                        `💡 Contoh: .cerdas mtk 5\n` +
                        `📖 Lihat menu: .cerdas menu`
                }, { quoted: m });
            }

            // Validate jumlah
            if (jumlah < 1 || jumlah > 10) {
                return sock.sendMessage(from, {
                    text: "❌ Jumlah soal harus antara 1-10!"
                }, { quoted: m });
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

            // Call API
            const apiUrl = `https://api.siputzx.my.id/api/games/cc-sd?matapelajaran=${mapel}&jumlahsoal=${jumlah}`;

            console.log('[Cerdas] Calling API:', apiUrl);

            const response = await fetch(apiUrl, {
                signal: AbortSignal.timeout(30000)
            });

            console.log('[Cerdas] API Response status:', response.status);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            console.log('[Cerdas] API Data:', JSON.stringify(data).substring(0, 200));

            if (!data.status || !data.data || !data.data.soal || !Array.isArray(data.data.soal)) {
                throw new Error('Invalid API response');
            }

            const questions = data.data.soal;

            if (questions.length === 0) {
                throw new Error('Tidak ada soal yang tersedia');
            }

            // Initialize multiplayer game state
            global.cerdasGame[from] = {
                questions: questions,
                mataPelajaran: mapel,
                currentIndex: 0,
                participants: {}, // { userId: { name, score, answers: [] } }
                startTime: Date.now(),
                questionStartTime: Date.now(),
                questionMessageKey: null,
                timer: null,
                countdownInterval: null
            };

            // Send first question
            await sendQuestionWithTimer(sock, from, m);

            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });

        } catch (error) {
            console.error('[Cerdas] Error:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: m.key } });

            let errorMessage = '❌ Terjadi kesalahan!\n\n';

            if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                errorMessage += '⏱️ Server API terlalu lama merespon (timeout).\n\n';
            } else if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
                errorMessage += '🌐 Tidak bisa terhubung ke server API.\n\n';
            } else if (error.message.includes('API Error: 400')) {
                errorMessage += '⚠️ Parameter tidak valid.\n\n';
            } else if (error.message.includes('API Error: 500')) {
                errorMessage += '🔧 Server API sedang bermasalah.\n\n';
            } else {
                errorMessage += `📝 ${error.message}\n\n`;
            }

            errorMessage += '💡 *Solusi:*\n';
            errorMessage += '• Coba lagi dalam beberapa saat\n';
            errorMessage += '• Pastikan koneksi internet stabil\n';
            errorMessage += '• Gunakan: .cerdas matematika 5';

            await sock.sendMessage(from, {
                text: errorMessage
            }, { quoted: m });
        }
    },

    // Function to check answer (called from message handler)
    checkAnswer: async (sock, m, userAnswer) => {
        const from = m.key.remoteJid;
        const game = global.cerdasGame[from];

        if (!game) return false;

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.split('@')[0];
        const currentQ = game.questions[game.currentIndex];
        const correctAnswerLetter = currentQ.jawaban_benar.toLowerCase().trim();
        const userAns = userAnswer.toLowerCase().trim();

        // Only accept single letter (a/b/c/d)
        const validAnswers = ['a', 'b', 'c', 'd'];
        if (!validAnswers.includes(userAns)) {
            return false; // Ignore other messages
        }

        // Initialize participant if first time answering
        if (!game.participants[sender]) {
            const contact = await sock.onWhatsApp(sender);
            const name = contact[0]?.notify || senderNumber;

            game.participants[sender] = {
                jid: sender,
                name: name,
                score: 0,
                answers: []
            };
        }

        const participant = game.participants[sender];

        // Check if already answered this question
        const alreadyAnswered = participant.answers.some(a => a.questionNum === game.currentIndex + 1);
        if (alreadyAnswered) {
            // Send warning that they already answered
            await sock.sendMessage(from, {
                text: `⚠️ Kamu sudah jawab soal ini!\nTunggu soal berikutnya ya 😊`
            }, { quoted: m });
            return true; // Already answered, ignore
        }

        // Check answer
        const isCorrect = (userAns === correctAnswerLetter);

        const correctOption = currentQ.semua_jawaban.find(opt => Object.keys(opt)[0] === correctAnswerLetter);
        const correctText = correctOption ? correctOption[correctAnswerLetter] : correctAnswerLetter;

        participant.answers.push({
            questionNum: game.currentIndex + 1,
            userAnswer: userAnswer.toUpperCase(),
            correctAnswer: `${correctAnswerLetter.toUpperCase()}. ${correctText}`,
            isCorrect: isCorrect
        });

        if (isCorrect) {
            participant.score++;
        }

        return true;
    }
};

// Helper function to send question with timer
async function sendQuestionWithTimer(sock, from, m) {
    const game = global.cerdasGame[from];
    if (!game) return;

    const currentQ = game.questions[game.currentIndex];
    const questionNum = game.currentIndex + 1;
    const totalQuestions = game.questions.length;

    // Format options
    let optionsText = '';
    currentQ.semua_jawaban.forEach(option => {
        const letter = Object.keys(option)[0];
        const text = option[letter];
        optionsText += `${letter.toUpperCase()}. ${text}\n`;
    });

    const baseQuestionText = `❓ *Soal ${questionNum}/${totalQuestions}*\n\n` +
        `${currentQ.pertanyaan}\n\n` +
        `${optionsText}\n`;

    const interactiveButtonsList = [
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: 'A', id: 'cc_a' })
        },
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: 'B', id: 'cc_b' })
        },
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: 'C', id: 'cc_c' })
        },
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: 'D', id: 'cc_d' })
        }
    ];

    // Send initial message
    const sentMsg = await sock.sendMessage(from, {
        text: baseQuestionText + `⏱️ Waktu: 15 detik`,
        footer: 'Cerdas Cermat - Pilih jawaban:',
        interactiveButtons: interactiveButtonsList
    });

    game.questionStartTime = Date.now();
    game.questionMessageKey = sentMsg.key;

    // Clear existing timers
    if (game.timer) clearTimeout(game.timer);
    if (game.countdownInterval) clearInterval(game.countdownInterval);

    let timeLeft = 15;

    // Update countdown every second
    game.countdownInterval = setInterval(async () => {
        timeLeft--;

        if (timeLeft > 0) {
            try {
                await sock.sendMessage(from, {
                    text: baseQuestionText + `⏱️ Waktu: ${timeLeft} detik`,
                    footer: 'Cerdas Cermat - Pilih jawaban:',
                    interactiveButtons: interactiveButtonsList,
                    edit: sentMsg.key
                });
            } catch (error) {
                console.error('[Cerdas] Countdown error:', error);
            }
        } else {
            clearInterval(game.countdownInterval);
        }
    }, 1000);

    // Main timer
    game.timer = setTimeout(async () => {
        if (game.countdownInterval) clearInterval(game.countdownInterval);

        try {
            await sock.sendMessage(from, {
                text: baseQuestionText + `⏱️ Waktu habis! ⏰`,
                edit: sentMsg.key
            });
        } catch (error) {
            console.error('[Cerdas] Timeout error:', error);
        }

        await nextQuestion(sock, from, m);
    }, 15000);
}

// Helper function to move to next question or end game
async function nextQuestion(sock, from, m) {
    const game = global.cerdasGame[from];
    if (!game) return;

    // Clear timers
    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }
    if (game.countdownInterval) {
        clearInterval(game.countdownInterval);
        game.countdownInterval = null;
    }

    // Move to next question
    game.currentIndex++;

    // Check if game is finished
    if (game.currentIndex >= game.questions.length) {
        await endGame(sock, from, m);
    } else {
        // Check if anyone answered the previous question
        const participants = Object.values(game.participants);
        const anyoneAnswered = participants.some(p => p.answers.length > 0);

        // If no one answered at all, end the game
        if (!anyoneAnswered && game.currentIndex > 0) {
            await sock.sendMessage(from, {
                text: `⏰ *Game Dihentikan*\n\nTidak ada yang menjawab soal.\nMain lagi yuk! .cerdas`
            });
            delete global.cerdasGame[from];
            return;
        }

        // Send next question
        await sendQuestionWithTimer(sock, from, m);
    }
}

// Helper function to end game and show results
async function endGame(sock, from, m) {
    const game = global.cerdasGame[from];
    if (!game) return;

    // Clear all timers
    if (game.timer) {
        clearTimeout(game.timer);
    }
    if (game.countdownInterval) {
        clearInterval(game.countdownInterval);
    }

    const totalQuestions = game.questions.length;
    const timeTaken = Math.floor((Date.now() - game.startTime) / 1000);

    // Build leaderboard
    const participants = Object.values(game.participants);

    // Check if no one participated
    if (participants.length === 0) {
        await sock.sendMessage(from, {
            text: `⏰ *Game Selesai*\n\nTidak ada yang menjawab soal.\nMain lagi yuk! .cerdas`
        });
        delete global.cerdasGame[from];
        return;
    }

    participants.sort((a, b) => b.score - a.score);

    let leaderboard = '🏆 *LEADERBOARD*\n\n';
    const mentions = [];

    participants.forEach((p, idx) => {
        const rank = idx + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const percentage = Math.round((p.score / totalQuestions) * 100);
        leaderboard += `${medal} @${p.jid.split('@')[0]}\n`;
        leaderboard += `   Skor: ${p.score}/${totalQuestions} (${percentage}%)\n\n`;
        mentions.push(p.jid);
    });

    // Build detailed answers for all participants
    let detailText = '📝 *DETAIL JAWABAN*\n\n';

    game.questions.forEach((q, qIdx) => {
        const correctLetter = q.jawaban_benar.toLowerCase();
        const correctOption = q.semua_jawaban.find(opt => Object.keys(opt)[0] === correctLetter);
        const correctText = correctOption ? correctOption[correctLetter] : correctLetter;

        detailText += `Soal ${qIdx + 1}:\n`;
        detailText += `✅ Jawaban: ${correctLetter.toUpperCase()}. ${correctText}\n\n`;

        // Show who answered what
        participants.forEach(p => {
            const answer = p.answers.find(a => a.questionNum === qIdx + 1);
            if (answer) {
                const icon = answer.isCorrect ? '✅' : '❌';
                detailText += `${icon} @${p.jid.split('@')[0]}: ${answer.userAnswer}\n`;
            }
        });
        detailText += '\n';
    });

    const finalText = `🎉 *GAME SELESAI!*\n\n` +
        `⏱️ Waktu: ${timeTaken} detik\n` +
        `👥 Peserta: ${participants.length} orang\n\n` +
        `${leaderboard}\n` +
        `${detailText}` +
        `💡 Main lagi: .cerdas`;

    await sock.sendMessage(from, {
        text: finalText,
        mentions: mentions
    });

    delete global.cerdasGame[from];
}
