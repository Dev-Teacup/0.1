document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const reasonBtn = document.getElementById('reason-btn');
    const attachFileBtn = document.getElementById('attach-file-btn');
    const fileInput = document.getElementById('file-input');
    const errorMessageDiv = document.getElementById('error-message');

    // Define API Keys - Primary and Alternatives
    const API_KEYS = [
        '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', // Your current primary key
        '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', // First alternative from your comments
        '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'  // Second alternative from your comments
    ];
    let activeApiKeyIndex = 0; // Index of the current (or last successful) API key

    const NON_REASONING_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const REASONING_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    const NON_REASONING_MODEL = "nvidia/llama-3.1-nemotron-ultra-253b-v1:free";
    const REASONING_MODEL = "deepseek/deepseek-r1:free";

    const AI_PERSONA_SYSTEM_MESSAGE = {
        role: 'system',
        content: "You are AITECHS AI, a helpful assistant created by Jaymark Cordial. When a user asks 'who are you', 'what are you', 'what is your name', or any similar question about your identity or creator, you must respond with: \"I'm AITECHS AI Created by: Jaymark Cordial\". For all other queries, provide helpful and relevant answers."
    };

    let currentAPI = NON_REASONING_API_URL;
    let currentModel = NON_REASONING_MODEL;
    let isReasoningActive = false;

    let chatHistory = [];

    function loadInitialChat() {
        const initialAIResponse = "💡 Tip: Click the lightbulb icon to toggle Reasoning Mode.\n\nOn: Best for Coding, Math, Science, and Medical questions (Note: Medical answers might be incorrect always consult your doctor!)\n\nOff: For simpler, more straightforward responses.\n\n(Developer: Jaymark Cordial)";
        displayMessage(initialAIResponse, "ai");
    }

    function displayMessage(text, sender, messageElementToUpdate = null, isReasoningStep = false) {
        let messageContainer;
        let messageContent;

        if (messageElementToUpdate) {
            messageContainer = messageElementToUpdate;
            messageContent = messageContainer.querySelector('.message-content');
            // If messageContent doesn't exist (e.g. reasoningStepsContainer was just created),
            // this might cause an error if not handled carefully by caller or CSS.
            // However, per instruction, this function's internal logic is not changed.
            if (messageContent) { // Added a null check for safety, though original didn't have it
                messageContent.innerText += text;
            } else {
                // Fallback or error if .message-content is not found in messageElementToUpdate
                // This part is tricky if reasoningStepsContainer is passed and is bare.
                // For now, adhering to not changing this function's core.
                // If it was intended that reasoningStepsContainer itself gets the text:
                // messageContainer.innerText += text;
                // But the original uses querySelector, so we keep that structure.
                // If querySelector is null, original code would error.
                // The original code's calls for reasoning steps might imply messageElementToUpdate has .message-content.
                console.warn("displayMessage: messageElementToUpdate does not contain '.message-content'. Text not appended for:", text, messageElementToUpdate);
            }
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
            messageContent.innerText = text;

            messageContainer.appendChild(messageContent);
            chatContainer.appendChild(messageContainer);
        }

        scrollToBottom();
        return messageContainer;
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

    async function fetchAIResponse() {
        const aiMessageContainer = displayMessage("", "ai"); // Create AI message bubble first
        const aiMessageContentElement = aiMessageContainer.querySelector('.message-content');
        aiMessageContentElement.innerText = "AI is thinking..."; // Initial message

        const messagesForAPI = [AI_PERSONA_SYSTEM_MESSAGE, ...chatHistory];
        let success = false;
        let currentOpenRouterApiKey;

        for (let i = 0; i < API_KEYS.length; i++) {
            let keyIndexToTry = (activeApiKeyIndex + i) % API_KEYS.length;
            currentOpenRouterApiKey = API_KEYS[keyIndexToTry];

            console.log(`Attempting API call with key index ${keyIndexToTry}: ${currentOpenRouterApiKey.substring(0, 15)}...`);

            if (currentOpenRouterApiKey.startsWith('sk-or-v1-') && currentOpenRouterApiKey.length < 50) {
                console.warn(`OpenRouter API Key (index ${keyIndexToTry}) might be a placeholder or incorrect. Please verify.`);
            }

            if (i > 0) { // If this is a retry attempt
                aiMessageContentElement.innerText = `Retrying with another API endpoint (Attempt ${i + 1}/${API_KEYS.length})...`;
            }

            try {
                const res = await fetch(currentAPI, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentOpenRouterApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: currentModel,
                        messages: messagesForAPI,
                        stream: true
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ error: { message: `Failed to parse error response. Status: ${res.statusText}` } }));
                    const errorMsg = errorData.error?.message ? `Error ${res.status}: ${errorData.error.message}` : `Error ${res.status}: ${res.statusText}`;
                    console.error(`API Error with key index ${keyIndexToTry}: ${errorMsg}`);

                    if (i === API_KEYS.length - 1) { // Last key tried
                        aiMessageContentElement.innerText = `Sorry, all API endpoints failed. Last error: ${errorMsg}`;
                        chatHistory.push({ role: 'assistant', content: `Error: All API endpoints failed. ${errorMsg}` });
                        return; // All keys failed
                    }
                    // Error with current key, loop will try the next one
                    continue;
                }

                // If response is OK, this key is now the active one
                activeApiKeyIndex = keyIndexToTry;
                console.log(`Successfully connected with API key index ${activeApiKeyIndex}`);

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let firstChunk = true;
                let accumulatedResponse = "";
                let isReasoning = false; // Local to this fetch attempt
                let reasoningStepsContainer = null; // Local to this fetch attempt

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break; // Stream finished
                    }

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.substring(6).trim();
                            if (jsonStr === '[DONE]') {
                                break; // End of data signal in this chunk, break from lines loop
                            }
                            try {
                                const parsed = JSON.parse(jsonStr);
                                const deltaContent = parsed.choices?.[0]?.delta?.content;

                                if (deltaContent) {
                                    if (firstChunk) {
                                        aiMessageContentElement.innerText = ""; // Clear "AI is thinking..." or "Retrying..."
                                        firstChunk = false;
                                    }

                                    // --- Start of Unchanged Reasoning Model Logic ---
                                    if (isReasoningActive && deltaContent.includes("Reasoning Step:") && !isReasoning) {
                                        isReasoning = true;
                                        reasoningStepsContainer = document.createElement('div');
                                        reasoningStepsContainer.classList.add('reasoning-steps-container');
                                        // Intentionally creating the .message-content for reasoningStepsContainer
                                        // so the original displayMessage can append to it as intended.
                                        // This slightly adapts to make the original displayMessage call work.
                                        const rscMsgContent = document.createElement('div');
                                        rscMsgContent.classList.add('message-content');
                                        reasoningStepsContainer.appendChild(rscMsgContent);

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
                                    // --- End of Unchanged Reasoning Model Logic ---
                                    scrollToBottom();
                                }
                            } catch (e) {
                                console.error('Error parsing stream data:', e, 'Chunk:', jsonStr);
                            }
                        }
                    }
                     // If a line contained '[DONE]', the inner 'for' loop's 'break' was hit.
                     // The 'while (true)' for reader.read() will continue until 'done' is true.
                }

                if (accumulatedResponse) {
                    chatHistory.push({ role: 'assistant', content: accumulatedResponse });
                } else if (firstChunk) { // Connected, but no actual content received
                    aiMessageContentElement.innerText = "AI returned an empty response.";
                    chatHistory.push({ role: 'assistant', content: "" });
                }
                success = true;
                break; // Successful, break from API key loop

            } catch (networkErr) { // Catches fetch-specific errors (e.g., network down)
                console.error(`Workspace/Network Error with key index ${keyIndexToTry}:`, networkErr);
                if (i === API_KEYS.length - 1) { // Last key attempt failed with network error
                    aiMessageContentElement.innerText = `Sorry, I couldn't connect to the AI due to a network issue after trying all endpoints. Please check your connection. Last error: ${networkErr.message}`;
                    chatHistory.push({ role: 'assistant', content: `Network error after trying all endpoints: ${networkErr.message}` });
                    return; // All keys failed
                }
                // Network error with current key, loop will try the next one
            }
        } // End of API key loop

        if (!success) {
            // This state should ideally be covered by the error messages within the loop.
            // If reached, it means all keys failed, and the last error should have been displayed.
            // Adding a generic fallback message here just in case, though it might override a more specific one.
            if (aiMessageContentElement.innerText.includes("AI is thinking") || aiMessageContentElement.innerText.includes("Retrying")) {
                 aiMessageContentElement.innerText = "Failed to connect to any AI service after multiple attempts.";
            }
            console.error("fetchAIResponse: All API key attempts failed. The final error message should have been set by the loop.");
            if (!chatHistory.some(entry => entry.role === 'assistant' && entry.content.startsWith("Error:"))) {
                 chatHistory.push({ role: 'assistant', content: "Failed to connect to any AI service." });
            }
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
        fetchAIResponse();
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
        }
        fileInput.value = '';
    });

    reasonBtn.title = "Switch to Reasoning Model";
    loadInitialChat();
});
