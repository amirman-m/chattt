const socket = io();
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');
const messageTemplate = document.getElementById('messageTemplate');
const finalResultTemplate = document.getElementById('finalResultTemplate');
const menuButton = document.getElementById('menuButton');
const sidebar = document.querySelector('.sidebar');
const objectSelection = document.getElementById('objectSelection');
const closeObjectSelection = document.getElementById('closeObjectSelection');
const objectCheckboxTemplate = document.getElementById('objectCheckboxTemplate');

let currentAgent = 1;
let lastResponse = null;
let waitingForInput = true;

// Default prompts for each agent
const defaultPrompts = {
    1: "The language analysis could be improved by considering:",
    2: "The sentiment analysis missed these emotional aspects:",
    3: "The entity recognition should also identify:",
    4: "The intent classification should consider these aspects:"
};

// Objects for each agent
const agentObjects = {
    1: [
        "Grammar and syntax",
        "Contextual meaning",
        "Idiomatic expressions",
        "Technical terms",
        "Cultural references"
    ],
    2: [
        "Tone variations",
        "Emotional undertones",
        "Sarcasm",
        "Cultural context",
        "Professional tone"
    ],
    3: [
        "Person names",
        "Organizations",
        "Locations",
        "Date/Time",
        "Product names"
    ],
    4: [
        "User goals",
        "Action items",
        "Decision points",
        "Requests",
        "Preferences"
    ]
};

// Common objects for all agents
const commonObjects = [
    "Accuracy",
    "Clarity",
    "Completeness",
    "Context",
    "Relevance"
];

// Toggle sidebar
menuButton.addEventListener('click', () => {
    sidebar.classList.toggle('expanded');
});

// Handle agent navigation
document.querySelectorAll('.agent-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetAgent = parseInt(btn.dataset.agent);
        if (targetAgent < currentAgent) {
            navigateToAgent(targetAgent);
        }
    });
});

// Update agent button states
function updateAgentButtons() {
    document.querySelectorAll('.agent-btn').forEach(btn => {
        const agentNum = parseInt(btn.dataset.agent);
        btn.classList.toggle('active', agentNum === currentAgent);
        // Only enable buttons for previous agents
        btn.disabled = agentNum >= currentAgent;
    });
}

// Navigate to specific agent
function navigateToAgent(targetAgent) {
    // Emit navigation event to server
    socket.emit('navigateToAgent', { targetAgent });
    
    // Update UI
    currentAgent = targetAgent;
    updateAgentButtons();
    
    // Enable input for new message
    waitingForInput = true;
    updateInputState();
    
    // Add system message
    addMessage(
        `Navigated back to Agent ${targetAgent}. Previous responses after this point have been cleared. Please provide a new message.`,
        'system'
    );
}

// Show object selection with appropriate objects
function showObjectSelection() {
    // Clear previous objects
    const commonObjectsList = document.getElementById('commonObjects');
    const agentObjectsList = document.getElementById('agentObjects');
    commonObjectsList.innerHTML = '';
    agentObjectsList.innerHTML = '';
    
    // Add common objects
    commonObjects.forEach(obj => {
        const checkbox = createObjectCheckbox(obj, 'common');
        commonObjectsList.appendChild(checkbox);
    });
    
    // Add agent-specific objects
    agentObjects[currentAgent].forEach(obj => {
        const checkbox = createObjectCheckbox(obj, 'agent');
        agentObjectsList.appendChild(checkbox);
    });
    
    // Show the selection box
    objectSelection.style.display = 'block';
    
    // Set default prompt
    messageInput.value = defaultPrompts[currentAgent];
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
}

// Create object checkbox element
function createObjectCheckbox(label, type) {
    const checkbox = objectCheckboxTemplate.content.cloneNode(true);
    const input = checkbox.querySelector('input');
    const labelEl = checkbox.querySelector('label');
    
    const id = `${type}-${label.toLowerCase().replace(/\s+/g, '-')}`;
    input.id = id;
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    
    input.addEventListener('change', () => updatePromptWithObjects());
    
    return checkbox;
}

// Update prompt based on selected objects
function updatePromptWithObjects() {
    const selectedObjects = Array.from(document.querySelectorAll('.object-checkbox input:checked'))
        .map(input => input.nextElementSibling.textContent);
    
    if (selectedObjects.length > 0) {
        const basePrompt = defaultPrompts[currentAgent];
        const objectsList = selectedObjects.join(', ');
        messageInput.value = `${basePrompt}\n- ${objectsList}`;
    } else {
        messageInput.value = defaultPrompts[currentAgent];
    }
    
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
}

// Close object selection
closeObjectSelection.addEventListener('click', () => {
    objectSelection.style.display = 'none';
});

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Handle message sending
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && currentAgent <= 4 && waitingForInput) {
        // Hide object selection if visible
        objectSelection.style.display = 'none';
        
        // Emit the message to server
        socket.emit('sendMessage', message);
        
        // Clear input and disable until response
        messageInput.value = '';
        messageInput.style.height = 'auto';
        waitingForInput = false;
        updateInputState();
    }
}

// Update input state based on current conditions
function updateInputState() {
    const inputWrapper = document.querySelector('.input-wrapper');
    
    if (currentAgent > 4) {
        // Disable input after all agents have processed
        inputWrapper.classList.add('disabled');
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = "Conversation complete. Refresh to start new.";
    } else if (!waitingForInput) {
        // Disable while waiting for response
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = "Waiting for response...";
    } else {
        // Enable for new input
        inputWrapper.classList.remove('disabled');
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.placeholder = "Message FAME AI...";
    }
}

// Add message to chat
function addMessage(text, sender, apiNumber = null, isFinal = false, showCameoButton = false) {
    // Remove welcome message if it exists
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Use final result template for system messages with Cameo button
    if (sender === 'system' && showCameoButton) {
        const messageContainer = finalResultTemplate.content.cloneNode(true);
        const messageContent = messageContainer.querySelector('.message-content');
        messageContent.textContent = text;

        // Add Cameo button event listener
        const cameoBtn = messageContainer.querySelector('.cameo-btn');
        cameoBtn.addEventListener('click', () => {
            handleCameoButtonClick(cameoBtn);
        });

        chatMessages.appendChild(messageContainer);
    } else {
        // Clone regular message template
        const messageContainer = messageTemplate.content.cloneNode(true);
        const messageElement = messageContainer.querySelector('.message');
        const messageContent = messageElement.querySelector('.message-content');
        messageContent.textContent = text;
        messageElement.classList.add(sender);

        // Add API number indicator if present
        if (apiNumber) {
            const apiIndicator = document.createElement('div');
            apiIndicator.className = 'api-indicator';
            apiIndicator.textContent = `API ${apiNumber}`;
            messageElement.insertBefore(apiIndicator, messageContent);
        }

        // Only show satisfaction buttons for AI responses that aren't final
        if (sender === 'ai' && !isFinal) {
            const satisfactionButtons = messageContainer.querySelector('.satisfaction-buttons');
            
            // Add event listeners to satisfaction buttons
            const satisfiedBtn = satisfactionButtons.querySelector('.satisfied');
            const notSatisfiedBtn = satisfactionButtons.querySelector('.not-satisfied');
            
            satisfiedBtn.addEventListener('click', () => {
                handleSatisfaction(true, satisfactionButtons, text);
            });
            
            notSatisfiedBtn.addEventListener('click', () => {
                handleSatisfaction(false, satisfactionButtons);
            });

            // Store last response
            lastResponse = text;
            
            // Enable satisfaction buttons
            waitingForInput = false;
            updateInputState();
        } else {
            // Remove satisfaction buttons for user and system messages
            messageContainer.querySelector('.satisfaction-buttons').remove();
        }

        // Add final response styling if applicable
        if (isFinal) {
            messageElement.classList.add('final-response');
        }

        chatMessages.appendChild(messageContainer);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
    updateAgentButtons();
}

// Handle satisfaction button clicks
function handleSatisfaction(isSatisfied, buttonsContainer, responseText) {
    // Emit satisfaction status to server
    socket.emit('satisfaction', { satisfied: isSatisfied });
    
    if (isSatisfied) {
        // Update UI for satisfied state
        const satisfiedBtn = buttonsContainer.querySelector('.satisfied');
        satisfiedBtn.style.backgroundColor = '#4CAF50';
        satisfiedBtn.style.borderColor = '#4CAF50';
        satisfiedBtn.style.color = '#fff';
        
        // Disable both buttons
        buttonsContainer.querySelectorAll('.satisfaction-btn').forEach(btn => {
            btn.disabled = true;
            if (!btn.classList.contains('satisfied')) {
                btn.style.opacity = '0.5';
            }
        });
        
        // Move to next agent
        currentAgent++;
        
        // Don't wait for input, response will be auto-forwarded
        waitingForInput = false;
        updateInputState();
        updateAgentButtons();
    } else {
        // Update UI for not satisfied state
        const notSatisfiedBtn = buttonsContainer.querySelector('.not-satisfied');
        notSatisfiedBtn.style.backgroundColor = '#f44336';
        notSatisfiedBtn.style.borderColor = '#f44336';
        notSatisfiedBtn.style.color = '#fff';
        
        // Remove the AI's last message
        const lastMessage = buttonsContainer.closest('.message-container');
        lastMessage.remove();
        
        // Show object selection and default prompt
        showObjectSelection();
        
        // Enable input for retry
        waitingForInput = true;
        updateInputState();
        
        // Focus on input
        messageInput.focus();
    }
}

// Handle Cameo button click
function handleCameoButtonClick(button) {
    // Disable button to prevent multiple clicks
    button.disabled = true;
    button.style.opacity = '0.7';
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    // Emit event to server
    socket.emit('sendToCameo');
}

// Socket event handlers
socket.on('message', (data) => {
    addMessage(data.text, data.sender, data.api_number, data.is_final, data.show_cameo_button);
    
    // Enable input after AI response if we're waiting for user input
    if (data.sender === 'ai' && !data.is_final) {
        waitingForInput = true;
        updateInputState();
    }
});

// Send message on button click
sendButton.addEventListener('click', sendMessage);

// Send message on Enter (but allow Shift+Enter for new lines)
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Initialize agent button states
updateAgentButtons();
