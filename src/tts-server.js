import express from 'express';
import cors from 'cors';
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const app = express();
app.use(cors());
app.use(express.json());

app.post('/tts', async (req, res) => {
    try {
        const { text, voice, rate } = req.body;
        const tts = new MsEdgeTTS();

        // Қазақ тілі үшін дауысты орнату
        await tts.setMetadata(
            voice || "kk-KZ-AigulNeural", 
            OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
        );

        // Аудио ағынын жасау
        const stream = tts.toStream(text);

        // Ағынды тікелей жіберу
        res.set({
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });

        // Ағынды клиентке жіберу
        stream.pipe(res);

    } catch (error) {
        console.error('TTS Error:', error);
        res.status(500).json({ error: 'TTS processing failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`TTS server is running on port ${PORT}`);
}); 