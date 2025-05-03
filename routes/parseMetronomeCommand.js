const natural = require('natural');
const { wordsToNumbers } = require('words-to-numbers');

let classifierInstance = null;
let isTraining = false;

const trainingData = [
    { text: ['start', 'play', 'go', 'begin', 'start the metronome', 'commence', 'turn on'], command: 'start' },
    { text: ['stop', 'pause', 'hold', 'end', 'stop the metronome', 'cease', 'shut up', 'turn off'], command: 'stop' },
    { text: [
      'set tempo to 100', 'tempo 120 bpm', 'make it 85', 'set bpm 90', 'change tempo 110', 'speed 75', 'set the speed to sixty', 'tempo one fifty', 'tempo 50', 'set tempo 50', 'make tempo 50', 'speed 50 bpm', 'set it to 50', 'tempo fifty',
      'set temple to 100', 'set temple to 50', 'set temple to 10', 'set temple to 200', 'set temple to 500',
      'set temp to 100', 'set temp to 50', 'set temp to 10', 'set temp to 200', 'set temp to 500',
      'set the temple to 100', 'set the temple to 50', 'set the temple to 10', 'set the temple to 200', 'set the temple to 500',
      'set the temp to 100', 'set the temp to 50', 'set the temp to 10', 'set the temp to 200', 'set the temp to 500',
      'change temple to 100', 'change temple to 50', 'change temple to 10', 'change temple to 200', 'change temple to 500',
      'change temp to 100', 'change temp to 50', 'change temp to 10', 'change temp to 200', 'change temp to 500',
      'make temple 100', 'make temple 50', 'make temple 10', 'make temple 200', 'make temple 500',
      'make temp 100', 'make temp 50', 'make temp 10', 'make temp 200', 'make temp 500',
      'temple 100', 'temple 50', 'temple 10', 'temple 200', 'temple 500',
      'temp 100', 'temp 50', 'temp 10', 'temp 200', 'temp 500',
    ], command: 'set_tempo' },
    { text: ['increase tempo', 'faster', 'speed up', 'go faster', 'up the tempo', 'make it faster', 'increase speed', 'tempo up', 'increase by 5', 'faster by 10'], command: 'increase_tempo' },
    { text: ['decrease tempo', 'slower', 'slow down', 'go slower', 'down the tempo', 'make it slower', 'decrease speed', 'tempo down', 'decrease by 5', 'slower by 10'], command: 'decrease_tempo' },
    { text: ['set time signature 4 4', 'time signature 3 over 4', 'make it 6 by 8', 'change time signature to 2 2', 'time sig three four', 'set it to six eight', 'set time signature to 4 over 4', 'time signature 4/4'], command: 'set_time_signature' },
    { text: ['hello', 'testing', 'what is this', 'metronome', 'hey', 'a metronome', 'wow', 'test', 'how are you', 'what time is it'], command: 'unknown' }
];


function getClassifier() {
    if (classifierInstance) {
        return classifierInstance;
    }
    if (isTraining) {
        console.warn("Classifier training already in progress.");
        return null;
    }

    isTraining = true;
    let localClassifier = null;

    try {
        localClassifier = new natural.BayesClassifier();

        trainingData.forEach(item => {
            localClassifier.addDocument(item.text, item.command);
        });

        localClassifier.train();
        classifierInstance = localClassifier;
    } catch (error) {
        console.error("FATAL: Error during classifier training:", error);
        classifierInstance = null;
    } finally {
        isTraining = false;
    }

    return classifierInstance;
}

function parseTempo(text) {
    let textWithNumbers = text.toLowerCase();
    try {
        textWithNumbers = wordsToNumbers(textWithNumbers);
    } catch (e) {
        console.warn(`wordsToNumbers failed for input "${text}":`, e);
    }

    const relevantText = String(textWithNumbers);

    const match = relevantText.match(/(\d+)(?:\s*bpm)?\s*$/);
    if (match && match[1]) {
        const tempo = parseInt(match[1], 10);
        return Math.max(10, Math.min(tempo, 1000));
    }
    return null;
}

function parseTimeSignature(text) {
    let textWithNumbers = text.toLowerCase();
    try {
        textWithNumbers = wordsToNumbers(textWithNumbers);
    } catch (e) {
        console.warn(`wordsToNumbers failed for input "${text}":`, e);
    }

    const relevantText = String(textWithNumbers);

    const match = relevantText.match(/(\d+)\s*(?:over|by|on|\/|\s)\s*(\d+)\s*$/);
    if (match && match.length === 3) {
        const num = parseInt(match[1], 10);
        const den = parseInt(match[2], 10);
        if (num > 0 && num <= 16 && [1, 2, 4, 8, 16, 32].includes(den)) {
            return { numerator: num, denominator: den };
        }
    }
    return null;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Invalid input: text is required and must be a string.' });
    }

    const classifier = getClassifier();

    if (!classifier) {
        return res.status(503).json({ error: 'Classifier not ready, please try again shortly.' });
    }

    try {
        let command = classifier.classify(text.toLowerCase());
        let params = {};

        let normalizedText = text.toLowerCase()
          .replace(/temple/g, 'tempo')
          .replace(/template/g, 'tempo')
          .replace(/temppo/g, 'tempo')
          .replace(/tempoo/g, 'tempo')
          .replace(/tembo/g, 'tempo')
          .replace(/temp\b/g, 'tempo')
          .replace(/b p m|b\.p\.m\.|beats per minute/g, 'bpm');

        if (command === 'start') {
            const startLike = /\b(start|play|go|begin|commence|turn on|start the metronome)\b/.test(normalizedText);
            const tempoLike = /tempo\b|temple\b|template\b|temppo\b|tempoo\b|tembo\b/.test(normalizedText);
            if (!startLike && !tempoLike) {
                command = 'unknown';
            }
        }

        if (command === 'start') {
            const tempoLike = /tempo\b|temple\b|template\b|temppo\b|tempoo\b|tembo\b/.test(normalizedText);
            if (tempoLike) {
                const allNumbers = normalizedText.match(/\d{1,4}/g);
                if (allNumbers && allNumbers.length > 0) {
                    command = 'set_tempo';
                    params.tempo = Math.max(10, Math.min(parseInt(allNumbers[allNumbers.length - 1], 10), 1000));
                }
            }
        }

        if (command === 'set_tempo') {
            const allNumbers = normalizedText.match(/\d{1,4}/g);
            if (allNumbers && allNumbers.length > 0) {
                params.tempo = Math.max(10, Math.min(parseInt(allNumbers[allNumbers.length - 1], 10), 1000));
            }
        }

        const validCommands = ['set_tempo', 'set_time_signature', 'increase_tempo', 'decrease_tempo', 'start', 'stop'];
        if (!validCommands.includes(command)) {
            command = 'unknown';
        }

        switch (command) {
            case 'set_tempo': {
                if (!params.tempo) {
                    const tempo = parseTempo(text);
                    if (tempo !== null) {
                        params.tempo = tempo;
                    } else {
                        console.warn(`Could not parse tempo from: "${text}"`);
                        return res.status(400).json({ error: 'Could not parse tempo value.' });
                    }
                }
                break;
            }
            case 'set_time_signature': {
                const timeSig = parseTimeSignature(text);
                if (timeSig !== null) {
                    params.numerator = timeSig.numerator;
                    params.denominator = timeSig.denominator;
                } else {
                    console.warn(`Could not parse time signature from: "${text}"`);
                    return res.status(400).json({ error: 'Could not parse time signature value.' });
                }
                break;
            }
            case 'increase_tempo':
            case 'decrease_tempo': {
                const amountMatch = text.match(/by\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
                if (amountMatch && amountMatch[1]) {
                    let parsedAmount;
                    try {
                        parsedAmount = parseInt(wordsToNumbers(amountMatch[1]), 10);
                    } catch {
                        parsedAmount = parseInt(amountMatch[1], 10);
                    }
                    if (!isNaN(parsedAmount)) {
                        params.amount = parsedAmount;
                    }
                }
                break;
            }
            case 'start':
            case 'stop':
                break;
            case 'unknown':
            default:
                res.status(200).json({ command: 'unknown', params: {} });
                return;
        }

        res.status(200).json({ command, params });

    } catch (error) {
        console.error('Error processing command:', error);
        res.status(500).json({ error: 'Internal Server Error processing command.' });
    }
};
