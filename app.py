from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import time
from collections import defaultdict

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app)

# Store user messages and API responses
user_sessions = defaultdict(lambda: {
    'message_count': 0,
    'messages': [],
    'api_responses': [],
    'is_satisfied': False
})

def simulate_azure_api_call(message, api_number):
    """Simulate calling different Azure APIs"""
    api_responses = {
        1: f"Azure API 1 processed: {message} - Language Analysis",
        2: f"Azure API 2 processed: {message} - Sentiment Analysis",
        3: f"Azure API 3 processed: {message} - Entity Recognition",
        4: f"Azure API 4 processed: {message} - Intent Classification"
    }
    time.sleep(1)  # Simulate API latency
    return api_responses.get(api_number, "Unknown API")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    session_id = request.sid
    user_sessions[session_id] = {
        'message_count': 0,
        'messages': [],
        'api_responses': [],
        'is_satisfied': False
    }

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in user_sessions:
        del user_sessions[request.sid]

@socketio.on('sendMessage')
def handle_message(message):
    session_id = request.sid
    session = user_sessions[session_id]
    
    if session['is_satisfied']:
        return
    
    current_count = session['message_count']
    
    if current_count >= 4:
        emit('message', {
            'text': "You've reached the maximum number of messages (4). Please start a new conversation.",
            'sender': 'system'
        })
        return

    # Add user message
    emit('message', {'text': message, 'sender': 'user'})
    session['messages'].append(message)
    
    # Determine which API to use (1-4)
    api_number = current_count + 1
    
    # Process message with corresponding API
    if current_count < 4:
        # If user was satisfied with previous response, use that as input
        input_message = message
        if current_count > 0 and session['api_responses']:
            last_response = session['api_responses'][-1]
            if session.get('last_satisfied', False):
                input_message = last_response
        
        api_response = simulate_azure_api_call(input_message, api_number)
        session['api_responses'].append(api_response)
        session['message_count'] += 1
        
        # Send response
        emit('message', {
            'text': api_response,
            'sender': 'ai',
            'api_number': api_number,
            'is_final': current_count == 3
        })
        
        # If this was the fourth message, send combined response
        if current_count == 3:
            combined_response = "\n".join(session['api_responses'])
            emit('message', {
                'text': f"Final Combined Response:\n{combined_response}",
                'sender': 'system',
                'is_final': True
            })

@socketio.on('satisfaction')
def handle_satisfaction(data):
    session_id = request.sid
    session = user_sessions[session_id]
    is_satisfied = data.get('satisfied', False)
    
    if is_satisfied:
        session['is_satisfied'] = True
    else:
        # Remove last message and response
        if session['messages']:
            session['messages'].pop()
        if session['api_responses']:
            session['api_responses'].pop()
        session['message_count'] -= 1
    
    session['last_satisfied'] = is_satisfied

if __name__ == '__main__':
    socketio.run(app, debug=True)
