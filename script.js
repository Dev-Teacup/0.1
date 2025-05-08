document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const reasonBtn = document.getElementById('reason-btn');
    const attachFileBtn = document.getElementById('attach-file-btn');
    const fileInput = document.getElementById('file-input');
    const errorMessageDiv = document.getElementById('error-message');

    // --- CONFIGURATION ---
    const OPENROUTER_API_KEY = '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'; // !!! REPLACE THIS !!!
    const NON_REASONING_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const REASONING_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    const NON_REASONING_MODEL = "nvidia/llama-3.1-nemotron-ultra-253b-v1:free";
    const REASONING_MODEL = "deepseek/deepseek-r1-zero:free";

    // Default to non-reasoning model
    let currentAPI = NON_REASONING_API_URL;
    let currentModel = NON_REASONING_MODEL;
    let isReasoningActive = false; // false means non-reasoning is active

    // --- INITIAL MESSAGE ---
    function loadInitialChat() {
        const initialAIResponse = "💡 Tip: Click the lightbulb icon to toggle Reasoning Mode.\n\nOn: Best for Coding, Math, Science, and Medical questions (Note: Medical answers might be incorrect always consult your doctor!)\n\nOff: For simpler, more straightforward responses.\n\n(Developer: Jaymark Cordial)";
        displayMessage(initialAIResponse, "ai");
    }

    // --- FUNCTIONS ---
    function displayMessage(text, sender) {
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message');

        if (sender === 'user') {
            messageContainer.classList.add('user-message');
        } else if (sender === 'ai') {
            messageContainer.classList.add('ai-message');
        } else if (sender === 'ai-system') {
            messageContainer.classList.add('system-message'); // For system notifications
        }

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        messageContent.innerText = text; // Safely set text content

        messageContainer.appendChild(messageContent);
        chatContainer.appendChild(messageContainer);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.classList.remove('hidden');
    }

    function hideError() {
        errorMessageDiv.classList.add('hidden');
    }

    async function fetchAIResponse(prompt) {
        if (OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY' || OPENROUTER_API_KEY.startsWith('sk-or-v1-')) {
            // 👀 Placeholder key warning
        }
    
        // 1️⃣ Show “thinking…” bubble
        const thinkingMessageDiv = document.createElement('div');
        thinkingMessageDiv.classList.add('message', 'ai-message');
        thinkingMessageDiv.innerHTML = `<div class="message-content">AI is thinking...</div>`;
        chatContainer.appendChild(thinkingMessageDiv);
        scrollToBottom();
    
        // Helper to clear the thinking bubble
        function removeThinking() {
            if (thinkingMessageDiv.parentNode === chatContainer) {
                chatContainer.removeChild(thinkingMessageDiv);
            }
        }
    
        try {
            const res = await fetch(currentAPI, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
    
            const errorData = !res.ok
                ? await res.json().catch(() => ({}))
                : null;
    
            if (!res.ok) {
                removeThinking();
                const msg = errorData.error?.message
                    ? `Error ${res.status}: ${errorData.error.message}`
                    : `Error ${res.status}`;
                displayMessage(`Sorry, I encountered an error. ${msg}`, 'ai');
                return;
            }
    
            const data = await res.json();
            const aiContent = data.choices?.[0]?.message?.content?.trim();
    
            if (aiContent) {
                removeThinking();
                displayMessage(aiContent, 'ai');
            } else {
                removeThinking();
                console.error('Unexpected format:', data);
                displayMessage("Sorry, I received an unexpected response from the AI.", 'ai');
            }
    
        } catch (err) {
            console.error('Fetch Error:', err);
            removeThinking();
            displayMessage("Sorry, I couldn't connect to the AI. Please check your connection or API configuration.", 'ai');
        }
    }    

    function handleSendMessage() {
        const messageText = userInput.value.trim();
        if (messageText === '') {
            showError('Please fill in the input field.');
            setTimeout(hideError, 3000);
            return;
        }
        hideError();
        displayMessage(messageText, "user");
        fetchAIResponse(messageText);
        userInput.value = '';
    }

    function toggleReasonAPI() {
        isReasoningActive = !isReasoningActive; // Toggle the state

        if (isReasoningActive) {
            // Switched TO reasoning
            currentAPI = REASONING_API_URL;
            currentModel = REASONING_MODEL;
            reasonBtn.classList.add('active');
            reasonBtn.title = "Switch to Non-Reasoning Model"; // Tooltip for the next action
            displayMessage("Reasoning model activated.", "ai-system");
        } else {
            // Switched TO non-reasoning
            currentAPI = NON_REASONING_API_URL;
            currentModel = NON_REASONING_MODEL;
            reasonBtn.classList.remove('active');
            reasonBtn.title = "Switch to Reasoning Model"; // Tooltip for the next action
            displayMessage("Non-Reasoning model activated.", "ai-system");
        }
        console.log("Reasoning Active:", isReasoningActive, "Current API:", currentAPI, "Model:", currentModel);
    }


    // --- EVENT LISTENERS ---
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSendMessage();
        }
    });

    reasonBtn.addEventListener('click', toggleReasonAPI);

    attachFileBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            displayMessage(`File selected: ${file.name} (Note: File uploading is not implemented in this demo).`, 'user');
            // Actual file processing/uploading would go here
        }
        fileInput.value = ''; // Reset file input
    });

    // --- INITIALIZE ---
    // Set the initial title for the reason button based on the default state
    reasonBtn.title = "Switch to Reasoning Model"; // Default is non-reasoning, so button offers to switch to reasoning
    loadInitialChat();
});
