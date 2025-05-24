document.addEventListener("DOMContentLoaded", function () {
    const shortSummaryButton = document.getElementById("shortSummary");
    const fullSummaryButton = document.getElementById("fullSummary");
    const infoButton = document.getElementById("infoButton");
    const closeButton = document.querySelector(".close-button");
    const infoPopup = document.getElementById("infoPopup");
    const refreshButton = document.getElementById("refreshSummary");
    const summaryDiv = document.getElementById("summary");
    const pageTitleElement = document.querySelector(".head-z"); // Title in header
    const generationTimeElement = document.getElementById("generationTime");
    const copyButton = document.getElementById("copyButton");
    const audioButton = document.getElementById("audioButton");
    const linkText = document.getElementById("linkText");
    const linkContainer = document.getElementById("linkContainer");
    const feedbackContainer = document.getElementById("feedbackContainer");
    const likeButton = document.getElementById("likeButton");
    const dislikeButton = document.getElementById("dislikeButton");
    const suggestionContainer = document.getElementById("suggestionContainer");
    const suggestionInput = document.getElementById("suggestionInput");
    const sendSuggestion = document.getElementById("sendSuggestion");

    // Add tooltips
    copyButton.setAttribute('title', 'Copy summary');
    audioButton.setAttribute('title', 'Play audio');
    
    let currentTab = null;
    let summaries = {};
    let currentMode = "short"; // Track current mode
    let isInfoVisible = false;
    let isPlaying = false;
    let contentType = "article"; // Default content type
    let currentAudio = null;

    // Set initial active state for short summary button
    shortSummaryButton.classList.add('active');

    // Automatically start generating summaries when popup opens
    generateBothSummaries();

    // Close button functionality
    closeButton.addEventListener("click", () => {
        window.close();
    });

    // Info popup functionality
    infoButton.addEventListener("click", () => {
        if (isInfoVisible) {
            infoPopup.classList.remove("show");
            isInfoVisible = false;
            return;
        }

        if (!summaries.timestamp) {
            summaries.timestamp = Date.now();
        }
        const date = new Date(summaries.timestamp);
        const year = date.getFullYear();
        const month = getKazakhMonth(date.getMonth());
        const day = date.getDate();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        generationTimeElement.textContent = `${year} ж. ${day} ${month} ${hours}:${minutes}`;
        infoPopup.classList.add("show");
        isInfoVisible = true;
    });

    // Click outside to close info popup
    document.addEventListener("click", (event) => {
        if (isInfoVisible && 
            !event.target.closest(".info-content") && 
            !event.target.closest("#infoButton")) {
            infoPopup.classList.remove("show");
            isInfoVisible = false;
        }
    });

    // Refresh button functionality
    refreshButton.addEventListener("click", () => {
        generateBothSummaries();
        infoPopup.classList.remove("show");
        isInfoVisible = false;
    });

    // Feedback functionality
    likeButton.addEventListener("click", function() {
        // Remove active state from both buttons
        dislikeButton.classList.remove('active');
        // Toggle active state for like button
        this.classList.toggle('active');
        // Hide suggestion container
        suggestionContainer.style.display = "none";
        
        // Store feedback
        if (currentTab) {
            const feedback = {
                type: this.classList.contains('active') ? 'like' : null,
                timestamp: Date.now()
            };
            
            chrome.storage.local.get(currentTab.url, (result) => {
                const data = result[currentTab.url] || {};
                data.feedback = feedback;
                chrome.storage.local.set({ [currentTab.url]: data });
            });
        }
    });

    dislikeButton.addEventListener("click", function() {
        // Remove active state from both buttons
        likeButton.classList.remove('active');
        // Toggle active state for dislike button
        this.classList.toggle('active');
        // Show/hide suggestion container based on active state
        suggestionContainer.style.display = this.classList.contains('active') ? "block" : "none";
        
        // Store feedback
        if (currentTab) {
            const feedback = {
                type: this.classList.contains('active') ? 'dislike' : null,
                timestamp: Date.now()
            };
            
            chrome.storage.local.get(currentTab.url, (result) => {
                const data = result[currentTab.url] || {};
                data.feedback = feedback;
                chrome.storage.local.set({ [currentTab.url]: data });
            });
        }
    });

    // Send suggestion functionality
    sendSuggestion.addEventListener("click", () => {
        const suggestion = suggestionInput.value.trim();
        if (suggestion && currentTab) {
            // Disable button and show loading state
            sendSuggestion.disabled = true;
            sendSuggestion.textContent = "Sending...";
            
            chrome.storage.local.get(currentTab.url, (result) => {
                const data = result[currentTab.url] || {};
                data.suggestion = {
                    text: suggestion,
                    timestamp: Date.now()
                };
                chrome.storage.local.set({ [currentTab.url]: data }, () => {
                    // Show success message
                    suggestionContainer.innerHTML = `
                        <div class="success-message">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4CAF50" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                            </svg>
                            <p>Your suggestion has been received!</p>
                        </div>
                    `;
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        // Clear and hide suggestion container
                        suggestionInput.value = "";
                        suggestionContainer.style.display = "none";
                        // Remove active state from dislike button
                        dislikeButton.classList.remove('active');
                        // Reset suggestion container content
                        suggestionContainer.innerHTML = `
                            <p class="suggestion-text">Please provide a suggestion to improve the summary</p>
                            <textarea id="suggestionInput" class="suggestion-input" rows="3" placeholder="Type your suggestion here..."></textarea>
                            <button id="sendSuggestion" class="suggestion-button">Send</button>
                        `;
                    }, 2000);
                });
            });
        }
    });

    // Function to update active button state
    function updateActiveButton() {
        shortSummaryButton.classList.remove('active');
        fullSummaryButton.classList.remove('active');
        if (currentMode === "short") {
            shortSummaryButton.classList.add('active');
        } else {
            fullSummaryButton.classList.add('active');
        }
    }

    // Function to show summary and reveal link button
    function showSummary(summary) {
        summaryDiv.innerHTML = formatSummary(summary);
        // Show link button and feedback section after summarization is complete
        linkContainer.style.display = "block";
        feedbackContainer.style.display = "block";
    }

    // Copy button functionality
    copyButton.addEventListener("click", () => {
        // Create a temporary input element to copy text to clipboard
        const tempInput = document.createElement("input");
        tempInput.value = summaries[currentMode];
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
        
        // Visual feedback that text was copied
        const originalHTML = copyButton.innerHTML;
        copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="M9 16.17L4.83 12l-1.42 1.41L9 19L21 7l-1.41-1.41z"/></svg>`;
        
        setTimeout(() => {
            copyButton.innerHTML = originalHTML;
        }, 2000);
    });

    // Edge TTS functionality
    async function playTextWithEdgeTTS(text) {
        try {
            const response = await fetch('http://localhost:3000/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    voice: 'kk-KZ-AigulNeural',
                    rate: '+0%'
                })
            });

            if (!response.ok) {
                throw new Error('TTS request failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                isPlaying = false;
                audioButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
                URL.revokeObjectURL(audioUrl);
            };

            audio.onplay = () => {
                isPlaying = true;
                audioButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
            };

            audio.onerror = () => {
                summaryDiv.innerHTML += `<p class="error">Error playing audio</p>`;
            };

            return audio;
        } catch (error) {
            throw error;
        }
    }

    // Audio button functionality
    audioButton.addEventListener("click", async () => {
        if (isPlaying) {
            // Stop playing
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
            isPlaying = false;
            audioButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        } else {
            try {
                const text = summaries[currentMode];
                currentAudio = await playTextWithEdgeTTS(text);
                currentAudio.play();
            } catch (error) {
                // Show error message to user
                summaryDiv.innerHTML += `<p class="error">Audio playback failed</p>`;
            }
        }
    });

    // Function to detect content type (video or article)
    async function detectContentType() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tab;

            // Check if it's a YouTube video
            if (tab.url.includes('youtube.com/watch')) {
                contentType = "video";
                return;
            }

            // Check for main video content
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    // Check for common video hosting platforms
                    const videoHosts = [
                        'vimeo.com',
                        'dailymotion.com',
                        'twitch.tv',
                        'facebook.com/watch',
                        'vk.com/video'
                    ];
                    
                    if (videoHosts.some(host => window.location.hostname.includes(host))) {
                        return true;
                    }

                    // Check if there's a main video element
                    const videos = document.querySelectorAll('video');
                    if (videos.length === 0) return false;

                    // Check if any video is prominent (large size)
                    for (const video of videos) {
                        const rect = video.getBoundingClientRect();
                        // If video is larger than 400x300, consider it main content
                        if (rect.width > 400 && rect.height > 300) {
                            return true;
                        }
                    }
                    
                    return false;
                }
            });

            contentType = results[0].result ? "video" : "article";
            updateContentTypeUI();
        } catch (error) {
            contentType = "article"; // Default to article on error
            updateContentTypeUI();
        }
    }

    // Function to get video URL
    async function getVideoUrl() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.url.includes('youtube.com/watch')) {
            return tab.url;
        }

        // Try to get video element src
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                const video = document.querySelector('video');
                return video ? video.src : null;
            }
        });

        return results[0].result;
    }

    // Function to get video title
    async function getVideoTitle() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                // For YouTube videos
                if (window.location.href.includes('youtube.com/watch')) {
                    const title = document.querySelector('h1.ytd-video-primary-info-renderer');
                    return title ? title.textContent.trim() : 'Video Title';
                }
                
                // For other videos
                const video = document.querySelector('video');
                if (video) {
                    // Try to get title from various sources
                    const possibleTitles = [
                        video.getAttribute('title'),
                        video.getAttribute('aria-label'),
                        document.title
                    ];
                    
                    // Return first non-empty title found
                    for (const title of possibleTitles) {
                        if (title && title.trim()) {
                            return title.trim();
                        }
                    }
                }
                
                return 'Video Title';
            }
        });

        return results[0].result || 'Video Title';
    }

    // Function to generate summaries
    async function generateBothSummaries() {
        try {
            await detectContentType();
            let storageKey = "summaries";
            let uniqueKey = "default";
            let pageContent = null;
            let videoUrl = null;
            let videoTitle = null;

            if (contentType === "video") {
                videoUrl = await getVideoUrl();
                if (!videoUrl) throw new Error('Video not found');
                videoTitle = await getVideoTitle();
                uniqueKey = videoUrl;
                storageKey = "videoSummaries";
                // Show loading indicator (only if summary is not in sessionStorage)
                summaryDiv.innerHTML = `
                    <div class="video-info">
                        <h3>${videoTitle}</h3>
                        <div class="loading">Summary generation in progress<span class="loading-dots">...</span></div>
                    </div>
                `;
            } else {
                // Get page content
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => {
                        const article = document.querySelector('article') || document.body;
                        const clone = article.cloneNode(true);
                        clone.querySelectorAll('script, style').forEach(el => el.remove());
                        return clone.innerText;
                    }
                });
                pageContent = results[0].result;
            }

            // Search for saved summary
            let allSummaries = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
            if (allSummaries[uniqueKey]) {
                summaries = allSummaries[uniqueKey];
                showSummaryWithBlocks(summaries[currentMode]);
                return;
            }

            // Request both summaries in parallel
            const shortPromise = new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    contentType === "video"
                        ? { action: "transcribeVideo", videoUrl, mode: "short" }
                        : { action: "summarizePage", content: pageContent, mode: "short" },
                    (response) => {
                        if (response && (response.summary || response.transcription)) {
                            resolve(response.summary || response.transcription);
                        } else {
                            resolve('');
                        }
                    }
                );
            });
            const fullPromise = new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    contentType === "video"
                        ? { action: "transcribeVideo", videoUrl, mode: "full" }
                        : { action: "summarizePage", content: pageContent, mode: "full" },
                    (response) => {
                        if (response && (response.summary || response.transcription)) {
                            resolve(response.summary || response.transcription);
                        } else {
                            resolve('');
                        }
                    }
                );
            });

            const [shortSummary, fullSummary] = await Promise.all([shortPromise, fullPromise]);
            summaries.short = shortSummary;
            summaries.full = fullSummary;
            summaries.timestamp = Date.now();

            // Save
            allSummaries[uniqueKey] = summaries;
            sessionStorage.setItem(storageKey, JSON.stringify(allSummaries));
            sessionStorage.setItem('currentMode', currentMode);

            showSummaryWithBlocks(summaries[currentMode]);
        } catch (error) {
            summaryDiv.innerHTML = `<div class="error">Error occurred: ${error.message}</div>`;
        }
    }

    // Read summaries from sessionStorage when popup opens
    document.addEventListener("DOMContentLoaded", function () {
        const savedSummaries = sessionStorage.getItem('summaries');
        const savedMode = sessionStorage.getItem('currentMode');
        if (savedSummaries) {
            summaries = JSON.parse(savedSummaries);
            currentMode = savedMode || "short";
            showSummaryWithBlocks(summaries[currentMode]);
        }
    });

    // Function to update UI based on content type
    function updateContentTypeUI() {
        const mainTitle = document.querySelector(".head-z");
        if (contentType === "video") {
            mainTitle.textContent = "Video Summarizer";
        } else {
            mainTitle.textContent = "Web Summarizer";
        }
    }

    function markdownToHtml(md) {
        // Headings
        md = md.replace(/^### (.*)$/gm, '<h3>$1</h3>');
        md = md.replace(/^## (.*)$/gm, '<h2>$1</h2>');
        md = md.replace(/^# (.*)$/gm, '<h1>$1</h1>');
        // Bold
        md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        md = md.replace(/\*(.+?)\*/g, '<em>$1</em>');
        md = md.replace(/_(.+?)_/g, '<em>$1</em>');
        // Links
        md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        // Lists
        md = md.replace(/^\* (.*)$/gm, '<li>$1</li>');
        // Wrap <li> in <ul>
        md = md.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
        // Paragraphs (lines not already wrapped)
        md = md.replace(/^(?!<h|<ul|<li|<p|<strong|<em|<a)(.+)$/gm, '<p>$1</p>');
        return md;
    }

    function showSummaryWithBlocks(summary) {
        summaryDiv.innerHTML = '';
        // Split text into blocks by two newlines (or one newline)
        const blocks = summary.split(/\n{2,}|\r{2,}|\r?\n/);
        blocks.forEach(block => {
            if (block && block.trim()) {
                summaryDiv.innerHTML += `<div class="summary-block visible"><p>${block.trim()}</p></div>`;
            }
        });
        linkContainer.style.display = "block";
        feedbackContainer.style.display = "block";
    }

    // Show stored summaries when buttons are clicked
    shortSummaryButton.addEventListener("click", () => {
        currentMode = "short";
        sessionStorage.setItem('currentMode', currentMode);
        updateActiveButton();
        if (summaries.short) {
            showSummaryWithBlocks(summaries.short);
        }
    });

    fullSummaryButton.addEventListener("click", () => {
        currentMode = "full";
        sessionStorage.setItem('currentMode', currentMode);
        updateActiveButton();
        if (summaries.full) {
            showSummaryWithBlocks(summaries.full);
        } else {
            summaryDiv.innerHTML = '<div class="error">Full summary not found</div>';
        }
    });

    // Function to format text into readable view
    function formatSummary(summary) {
        return summary
            .split(". ")
            .map(sentence => `<p>${sentence.trim()}.</p>`)
            .join("");
    }

    // Helper function for Kazakh month names
    function getKazakhMonth(monthIndex) {
        const months = [
            'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
            'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'
        ];
        return months[monthIndex];
    }

    // Localization resources
    let locale = localStorage.getItem('locale') || 'kk';
    let translations = {};

    async function loadLocale(lang) {
        const res = await fetch(`locales/${lang}.json`);
        translations = await res.json();
        locale = lang;
        localStorage.setItem('locale', lang);
    }

    function t(key, params = {}) {
        let str = translations[key] || key;
        Object.keys(params).forEach(k => {
            str = str.replace(`{${k}}`, params[k]);
        });
        return str;
    }

    function updateUITexts() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.innerHTML = t(el.getAttribute('data-i18n'));
        });
        // Buttons and tooltips
        copyButton.setAttribute('title', t('copy_summary'));
        audioButton.setAttribute('title', t('audio_summary'));
        linkText.setAttribute('title', t('link_summary'));
        // Feedback question
        document.querySelector('#feedbackContainer p').innerHTML = t('feedback_question');
        // Suggestion
        document.querySelector('.suggestion-text').innerHTML = t('suggestion_text');
        document.querySelector('#sendSuggestion').innerHTML = t('send_suggestion');
        // Info time
        document.querySelector('#infoPopup .info-content p').innerHTML = t('info_time');
        // Refresh
        document.querySelector('#refreshSummary').innerHTML = t('refresh');
        // Summary buttons
        shortSummaryButton.innerHTML = t('short_summary');
        fullSummaryButton.innerHTML = t('full_summary');
    }

    // Globe icon language switch logic
    const languageToggle = document.getElementById('languageToggle');
    languageToggle.addEventListener('click', async () => {
        const newLocale = locale === 'kk' ? 'en' : 'kk';
        await loadLocale(newLocale);
        updateUITexts();
        // Re-show summary
        showSummaryWithBlocks(summaries[currentMode]);
    });

    // Load localization when DOM is fully loaded
    window.addEventListener('DOMContentLoaded', async () => {
        await loadLocale(locale);
        updateUITexts();
    });
});