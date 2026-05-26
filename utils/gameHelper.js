// Helper function to check if any game is active in a chat
export function hasActiveGame(from) {
    const gameTypes = [
        'tebakKata',
        'tebakHewan',
        'tebakGambar',
        'tebakTebakan',
        'siapakahaku',
        'lengkapiKalimat',
        'cakLontong',
        'family100',
        'cerdasGame'
    ];

    for (const gameType of gameTypes) {
        if (global[gameType] && global[gameType][from]) {
            return gameType;
        }
    }

    return null;
}

// Helper function to get game display name
export function getGameDisplayName(gameType) {
    const names = {
        'tebakKata': 'Tebak Kata',
        'tebakHewan': 'Tebak Hewan',
        'tebakGambar': 'Tebak Gambar',
        'tebakTebakan': 'Tebak-Tebakan',
        'siapakahaku': 'Siapa Aku',
        'lengkapiKalimat': 'Lengkapi Kalimat',
        'cakLontong': 'Cak Lontong',
        'family100': 'Family 100',
        'cerdasGame': 'Cerdas Cermat'
    };

    return names[gameType] || gameType;
}

// Helper function to generate scrambled clue from answer
// Shows random letters from the answer, rest as underscores
// Example: "kucing" -> "K _ _ I _ G" or "_ U _ _ N _"
export function generateScrambledClue(answer) {
    const letters = answer.split('');
    const length = letters.length;

    // Show 30-40% of letters randomly
    const numToShow = Math.max(1, Math.floor(length * 0.35));

    // Create array of indices
    const indices = Array.from({ length }, (_, i) => i);

    // Shuffle and pick random indices to show
    const shuffled = indices.sort(() => Math.random() - 0.5);
    const indicesToShow = shuffled.slice(0, numToShow);

    // Build clue string
    const clue = letters.map((letter, index) => {
        if (indicesToShow.includes(index)) {
            return letter.toUpperCase();
        } else if (letter === ' ') {
            return ' '; // Keep spaces
        } else {
            return '_';
        }
    }).join(' ');

    return clue;
}

// Helper function to start countdown timer for game
// Updates message every 5 seconds to show remaining time
export function startGameCountdown(sock, from, messageKey, baseText, duration = 120, onTimeout) {
    let timeLeft = duration;

    // Update every 5 seconds
    const countdownInterval = setInterval(async () => {
        timeLeft -= 5;

        if (timeLeft > 0) {
            try {
                await sock.sendMessage(from, {
                    text: `${baseText}\n\n⏱️ Waktu: ${timeLeft} detik\n💡 Ketik *clue* untuk petunjuk\n💡 Ketik *nyerah* untuk menyerah.`,
                    edit: messageKey
                });
            } catch (error) {
                console.error('[Countdown] Update error:', error);
            }
        } else {
            clearInterval(countdownInterval);
        }
    }, 5000);

    // Main timeout
    const timeout = setTimeout(async () => {
        clearInterval(countdownInterval);

        try {
            await sock.sendMessage(from, {
                text: `${baseText}\n\n⏱️ Waktu habis! ⏰`,
                edit: messageKey
            });
        } catch (error) {
            console.error('[Countdown] Timeout error:', error);
        }

        if (onTimeout) onTimeout();
    }, duration * 1000);

    return { timeout, countdownInterval };
}
