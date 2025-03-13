from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import time
import json
import os
from datetime import datetime
from collections import defaultdict

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app)

# Create output directory if it doesn't exist
os.makedirs('output', exist_ok=True)

# Store user messages and API responses
user_sessions = defaultdict(lambda: {
    'messages': [],
    'api_responses': [],
    'current_agent': 1,
    'last_satisfied': False,
    'last_response': None,
    'pending_message': None
})

def simulate_azure_api_call(message, api_number):
    """Simulate calling different Azure APIs"""
    api_responses = {
        1: f"Azure API {api_number} processed: {message} - Language Analysis",
        2: f"Azure API {api_number} processed: {message} - Sentiment Analysis",
        3: f"Azure API {api_number} processed: {message} - Entity Recognition",
        4: f"Azure API {api_number} processed: {message} - Intent Classification"
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
        'messages': [],
        'api_responses': [],
        'current_agent': 1,
        'last_satisfied': False,
        'last_response': None,
        'pending_message': None
    }

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in user_sessions:
        del user_sessions[request.sid]

def process_with_next_agent(session):
    """Process the pending message with the next agent"""
    if session['current_agent'] <= 4 and session['pending_message'] is not None:
        api_response = simulate_azure_api_call(session['pending_message'], session['current_agent'])
        session['api_responses'].append(api_response)
        session['last_response'] = api_response
        
        # Send response
        emit('message', {
            'text': api_response,
            'sender': 'ai',
            'api_number': session['current_agent'],
            'is_final': session['current_agent'] == 4
        })
        
        # If this was the fourth agent, send combined response
        if session['current_agent'] == 4:
            combined_response = "\n".join(session['api_responses'])
            emit('message', {
                'text': f"Final Combined Response:\n{combined_response}",
                'sender': 'system',
                'is_final': True,
                'show_cameo_button': True
            })

@socketio.on('sendMessage')
def handle_message(message):
    session_id = request.sid
    session = user_sessions[session_id]
    current_agent = session['current_agent']
    
    if current_agent > 4:
        emit('message', {
            'text': "All agents have processed your message. You can start a new conversation.",
            'sender': 'system'
        })
        return

    # Add user message to chat
    emit('message', {'text': message, 'sender': 'user'})
    session['messages'].append(message)
    
    # Store message for processing
    session['pending_message'] = message
    
    # Process with current agent
    process_with_next_agent(session)

@socketio.on('navigateToAgent')
def handle_navigation(data):
    """Handle navigation to a specific agent"""
    session_id = request.sid
    session = user_sessions[session_id]
    target_agent = data.get('targetAgent', 1)
    
    if target_agent < session['current_agent']:
        # Clear responses after the target agent
        session['api_responses'] = session['api_responses'][:target_agent - 1]
        session['current_agent'] = target_agent
        session['last_response'] = None
        session['pending_message'] = None
        session['last_satisfied'] = False

@socketio.on('satisfaction')
def handle_satisfaction(data):
    session_id = request.sid
    session = user_sessions[session_id]
    is_satisfied = data.get('satisfied', False)
    
    if is_satisfied:
        # Move to next agent and use last response as input
        session['current_agent'] += 1
        session['last_satisfied'] = True
        session['pending_message'] = session['last_response']
        # Automatically process with next agent
        process_with_next_agent(session)
    else:
        # Stay on current agent but allow new input
        session['last_satisfied'] = False
        session['pending_message'] = None
        # Last response will be cleared, waiting for new user input

@socketio.on('sendToCameo')
def handle_send_to_cameo():
    """Handle the Send to Cameo button click"""
    session_id = request.sid
    session = user_sessions[session_id]
    
    # Create JSON data structure
    cameo_data = {
        'timestamp': datetime.now().isoformat(),
        'session_id': session_id,
        'responses': []
    }
    
    # Add responses from each agent
    for i, response in enumerate(session['api_responses'], 1):
        cameo_data['responses'].append({
            'agent': f'Agent {i}',
            'response': response
        })
    
    # Generate unique filename
    filename = f'output/cameo_data_{session_id}_{int(time.time())}.json'
    
    # Save to JSON file
    with open(filename, 'w') as f:
        json.dump(cameo_data, f, indent=2)
    
    # Send confirmation to client
    emit('message', {
        'text': f"Data has been saved to {filename}",
        'sender': 'system'
    })

if __name__ == '__main__':
    socketio.run(app, debug=True)
