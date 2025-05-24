// Gemini API key - VERY DANGEROUS! DO NOT STORE THE API KEY ON THE CLIENT SIDE!
// Replace this with your own API key, but do not do this in production.
// It is better to use a server-side proxy to securely store the API key.
const GEMINI_API_KEY = 'API_KEY'; // ATTENTION: Keep this key in a safe place!

// API endpoints
const API_ENDPOINTS = {
    // It is recommended to use a stable model for text generation
    text,video: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-03-25:generateContent", // Or gemini-pro
    // For video, you can use the experimental model or the stable 2.5 pro version
    video: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-03-25:generateContent" // You can use the stable version instead of the experimental model
};

// Error messages ()
const ERROR_MESSAGES = {
    400: "The request format is incorrect. Check the JSON structure.",
    401: "The API key is invalid or not specified. Check the API key.",
    403: "The API key does not have permission for this operation. Check permissions.",
    429: "You have reached the request limit. Please try again later.",
    500: "An internal server error occurred. Please try again later.",
    503: "The server is temporarily unavailable. Please try again in a few minutes.",
    fetch: "A network error occurred. Check your internet connection or the API endpoint.",
    unknown: "An unknown API error occurred. See the full response in the console.",
    invalidResponse: "An invalid or empty response was received from the API.",
    noContent: "The expected content was not found in the API response."
};

// General function to send a request to the Gemini API
async function makeApiRequest(endpoint, requestBody, apiKey, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(`${endpoint}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // If it's a 503 error or other server error, retry
                if (response.status === 503 || response.status >= 500) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    continue;
                }

                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {
                }
                const errorMessage = ERROR_MESSAGES[response.status] || errorData?.error?.message || ERROR_MESSAGES.unknown;
                const error = new Error(errorMessage);
                error.status = response.status;
                error.details = errorData;
                throw error;
            }

            const data = await response.json();

            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].text) {
                throw new Error(ERROR_MESSAGES.noContent);
            }

            return data.candidates[0].content.parts[0].text.trim();
        } catch (error) {
            if (attempt === maxRetries - 1) {
                // If this was the last attempt, throw the error
                if (error instanceof TypeError) {
                    const networkError = new Error(ERROR_MESSAGES.fetch);
                    networkError.originalError = error;
                    throw networkError;
                }
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

// Function to summarize page content
async function summarizePageContent(pageContent, mode, sendResponse) {
    try {
        // Create prompt based on mode
        const prompt = mode === 'short'
            ? `Summarize the given text in Kazakh briefly (cover the main ideas): ${pageContent}`
            : `Summarize the given text  in detail and clearly: ${pageContent}`;

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7, // You can slightly lower the temperature for more stability
                topP: 0.95,
                topK: 64,
                maxOutputTokens: 8192 // This may also be sufficient for a short summary
            }
            // safetySettings may be required
        };

        const summary = await makeApiRequest(API_ENDPOINTS.text, requestBody, GEMINI_API_KEY);

        sendResponse({ action: "summaryResponse", summary });

    } catch (error) {
        sendResponse({
            action: "error",
            error: error.message || ERROR_MESSAGES.unknown,
            details: error.details // Send additional info
        });
    }
}

// Function for video transcription
async function transcribeVideo(videoUrl, mode, sendResponse) {
    if (!videoUrl || !videoUrl.startsWith('http')) {
         sendResponse({
            action: "error",
            error: "Invalid video URL provided."
         });
         return true;
    }

    try {
        // Create prompt based on mode
        let prompt;
        if (mode === 'short') {
            prompt = `Briefly summarize the main ideas of this video .`;
        } else {
            prompt = `Create a full transcription of this video. Separate each utterance or paragraph into a separate block.`;
        }

        const requestBody = {
            contents: [{
                parts: [
                    {
                        file_data: {
                            mime_type: "video/mp4",
                            file_uri: videoUrl
                        }
                    },
                    { text: prompt }
                ]
            }],
            generationConfig: {
                temperature: 0.5,
                topP: 0.95,
                topK: 64,
                maxOutputTokens: 16384
            }
        };

        const transcription = await makeApiRequest(API_ENDPOINTS.video, requestBody, GEMINI_API_KEY);
        
        // Send transcription result
        sendResponse({
            action: "transcriptionComplete",
            transcription: transcription
        });

    } catch (error) {
        sendResponse({
            action: "error",
            error: error.message || "An unknown error occurred",
            details: error.details
        });
    }
    
    return true;
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "summarizePage") {
        const pageContent = request.content;
        if (!pageContent) {
            sendResponse({ action: "error", error: "Page content is empty for summarization."});
            return false; // Synchronous response
        }
        const mode = request.mode || 'short';
        summarizePageContent(pageContent, mode, sendResponse);
        return true; // Asynchronous response expected
    } else if (request.action === "transcribeVideo") {
        const videoUrl = request.videoUrl;
         if (!videoUrl) {
            sendResponse({ action: "error", error: "No video URL provided for transcription."});
            return false; // Synchronous response
        }
        const mode = request.mode || 'full';
        transcribeVideo(videoUrl, mode, sendResponse);
        return true; // Asynchronous response expected
    }
});