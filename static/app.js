const socket = io();
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');
const messageTemplate = document.getElementById('messageTemplate');

let messageCount = 0;
let lastResponse = null;

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Handle message sending
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && messageCount < 4) {
        // Emit the message to server
        socket.emit('sendMessage', message);
        
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Increment message count
        messageCount++;
    }
}

// Add message to chat
function addMessage(text, sender, apiNumber = null, isFinal = false) {
    // Remove welcome message if it exists
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Clone message template
    const messageContainer = messageTemplate.content.cloneNode(true);
    const messageElement = messageContainer.querySelector('.message');
    messageElement.textContent = text;
    messageElement.classList.add(sender);

    // Add API number indicator if present
    if (apiNumber) {
        const apiIndicator = document.createElement('div');
        apiIndicator.className = 'api-indicator';
        apiIndicator.textContent = `API ${apiNumber}`;
        messageElement.insertBefore(apiIndicator, messageElement.firstChild);
    }

    // Only show satisfaction buttons for AI responses
    if (sender === 'ai') {
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
    } else {
        // Remove satisfaction buttons for user and system messages
        messageContainer.querySelector('.satisfaction-buttons').remove();
    }

    // Add final response styling if applicable
    if (isFinal) {
        messageElement.classList.add('final-response');
    }

    chatMessages.appendChild(messageContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle satisfaction button clicks
function handleSatisfaction(isSatisfied, buttonsContainer, responseText) {
    const inputWrapper = document.querySelector('.input-wrapper');
    
    // Emit satisfaction status to server
    socket.emit('satisfaction', { satisfied: isSatisfied });
    
    if (isSatisfied) {
        // Disable input if satisfied or if we've reached 4 messages
        if (messageCount >= 4) {
            inputWrapper.classList.add('disabled');
            messageInput.disabled = true;
            sendButton.disabled = true;
        }
        
        // Update button styles
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
    } else {
        // Re-enable input if not satisfied
        inputWrapper.classList.remove('disabled');
        messageInput.disabled = false;
        sendButton.disabled = false;
        
        // Update button styles
        const notSatisfiedBtn = buttonsContainer.querySelector('.not-satisfied');
        notSatisfiedBtn.style.backgroundColor = '#f44336';
        notSatisfiedBtn.style.borderColor = '#f44336';
        notSatisfiedBtn.style.color = '#fff';
        
        // Remove the AI's last message
        const lastMessage = buttonsContainer.closest('.message-container');
        lastMessage.remove();
        
        // Decrement message count
        messageCount--;
        
        // Focus on input
        messageInput.focus();
    }
}

// Socket event handlers
socket.on('message', (data) => {
    addMessage(data.text, data.sender, data.api_number, data.is_final);
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
