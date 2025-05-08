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
    const REASONING_MODEL = "deepseek/deepseek-r1:free";

    // Default to non-reasoning model
    let currentAPI = NON_REASONING_API_URL;
    let currentModel = NON_REASONING_MODEL;
    let isReasoningActive = false; // false means non-reasoning is active

    let chatHistory = []; // holds the full conversation

    // --- INITIAL MESSAGE ---
    function loadInitialChat() {
        const initialAIResponse = "💡 Tip: Click the lightbulb icon to toggle Reasoning Mode.\n\nOn: Best for Coding, Math, Science, and Medical questions (Note: Medical answers might be incorrect always consult your doctor!)\n\nOff: For simpler, more straightforward responses.\n\n(Developer: Jaymark Cordial)";
        displayMessage(initialAIResponse, "ai");
        // Add initial AI message to history for context if needed, though it's a system tip
        // chatHistory.push({ role: 'assistant', content: initialAIResponse });
    }

    // --- FUNCTIONS ---
    function displayMessage(text, sender, messageElementToUpdate = null, isReasoningStep = false) {
        let messageContainer;
        let messageContent;

        if (messageElementToUpdate) {
            messageContainer = messageElementToUpdate;
            messageContent = messageContainer.querySelector('.message-content');
            messageContent.innerText += text; // Append text for streaming
        } else {
            messageContainer = document.createElement('div');
            messageContainer.classList.add('message');

            if (sender === 'user') {
                messageContainer.classList.add('user-message');
            } else if (sender === 'ai') {
                messageContainer.classList.add('ai-message');
            } else if (sender === 'ai-system') {
                messageContainer.classList.add('system-message');
            } else if (sender === 'reasoning-step') {
                messageContainer.classList.add('reasoning-step-message');
            }

            messageContent = document.createElement('div');
            messageContent.classList.add('message-content');
            messageContent.innerText = text; // Set initial text

            messageContainer.appendChild(messageContent);
            chatContainer.appendChild(messageContainer);
        }

        scrollToBottom();
        return messageContainer; // Return the container for potential updates
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

    async function fetchAIResponse() { // Removed prompt argument as it uses chatHistory
        if (OPENROUTER_API_KEY.startsWith('sk-or-v1-') && OPENROUTER_API_KEY.length < 50) { // Basic check
            console.warn("OpenRouter API Key might be a placeholder or incorrect. Please verify.");
            // displayMessage("Warning: API Key might be a placeholder. Please check console.", "ai-system");
        }

        // Create a new AI message container for the streamed response
        // We'll pass this to displayMessage to append content
        const aiMessageContainer = displayMessage("", "ai"); // Create an empty AI message
        const aiMessageContentElement = aiMessageContainer.querySelector('.message-content');
        aiMessageContentElement.innerText = "AI is thinking..."; // Initial "thinking" text

        let accumulatedResponse = ""; // To store the full response for chat history
        let reasoningStepsContainer = null; // To hold the container for reasoning steps

        try {
            const res = await fetch(currentAPI, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages: chatHistory,
                    stream: true // Enable streaming
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({})); // Try to parse error JSON
                const msg = errorData.error?.message
                    ? `Error ${res.status}: ${errorData.error.message}`
                    : `Error ${res.status}: ${res.statusText}`;
                aiMessageContentElement.innerText = `Sorry, I encountered an error. ${msg}`; // Update the thinking message
                chatHistory.push({ role: 'assistant', content: `Error: ${msg}` }); // Add error to history
                return;
            }

            // Handle the stream
            const reader = res.body.getReader();
            const decoder = new TextDecoder(); // To decode Uint8Array to string
            let firstChunk = true;
            let isReasoning = false; // Flag to detect if reasoning steps are being sent

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break; // Stream finished
                }

                const chunk = decoder.decode(value);
                // Assuming OpenRouter uses Server-Sent Events (SSE) format for streaming
                // SSE messages are typically prefixed with "data: " and end with "\n\n"
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6).trim(); // Remove "data: " prefix
                        if (jsonStr === '[DONE]') { // Check for OpenRouter's stream termination signal
                            break;
                        }
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const deltaContent = parsed.choices?.[0]?.delta?.content;

                            if (deltaContent) {
                                if (firstChunk) {
                                    aiMessageContentElement.innerText = ""; // Clear "AI is thinking..."
                                    firstChunk = false;
                                }

                                // Check for a specific indicator of reasoning steps (you might need to adjust this based on the model's output)
                                if (isReasoningActive && deltaContent.includes("Reasoning Step:") && !isReasoning) {
                                    isReasoning = true;
                                    reasoningStepsContainer = document.createElement('div');
                                    reasoningStepsContainer.classList.add('reasoning-steps-container');
                                    aiMessageContainer.appendChild(reasoningStepsContainer);
                                    displayMessage("Reasoning:", "ai-system", reasoningStepsContainer);
                                }

                                if (isReasoning && reasoningStepsContainer) {
                                    if (deltaContent.startsWith("Reasoning Step:")) {
                                        displayMessage(deltaContent, "reasoning-step", reasoningStepsContainer);
                                    } else if (!deltaContent.includes("Reasoning Step:")) {
                                        aiMessageContentElement.innerText += deltaContent;
                                        accumulatedResponse += deltaContent;
                                    }
                                } else {
                                    aiMessageContentElement.innerText += deltaContent;
                                    accumulatedResponse += deltaContent;
                                }
                                scrollToBottom(); // Scroll as new content is added
                            }
                        } catch (e) {
                            console.error('Error parsing stream data:', e, 'Chunk:', jsonStr);
                        }
                    }
                }
            }

            if (accumulatedResponse) {
                chatHistory.push({ role: 'assistant', content: accumulatedResponse });
            } else if (firstChunk) { // No content was streamed, but no error from API
                aiMessageContentElement.innerText = "AI returned an empty response.";
                chatHistory.push({ role: 'assistant', content: "" }); // Or some indicator of empty response
            }

        } catch (err) {
            console.error('Fetch Stream Error:', err);
            aiMessageContentElement.innerText = "Sorry, I couldn't connect to the AI. Please check your connection or API configuration.";
            chatHistory.push({ role: 'assistant', content: "Connection error or API config issue." });
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

        chatHistory.push({ role: 'user', content: messageText });

        fetchAIResponse(); // Call the modified function
        userInput.value = '';
    }

    function toggleReasonAPI() {
        isReasoningActive = !isReasoningActive;

        if (isReasoningActive) {
            currentAPI = REASONING_API_URL;
            currentModel = REASONING_MODEL;
            reasonBtn.classList.add('active');
            reasonBtn.title = "Switch to Non-Reasoning Model";
            displayMessage("Reasoning model activated.", "ai-system");
        } else {
            currentAPI = NON_REASONING_API_URL;
            currentModel = NON_REASONING_MODEL;
            reasonBtn.classList.remove('active');
            reasonBtn.title = "Switch to Reasoning Model";
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
            displayMessage(`File selected: ${file.name} (Note: File uploading is not implemented in this BETA (ONGOING DEVELOPMENT).`, 'user');
            // Actual file processing/uploading would go here
        }
        fileInput.value = ''; // Reset file input
    });

    // --- INITIALIZE ---
    reasonBtn.title = "Switch to Reasoning Model";
    loadInitialChat();
});