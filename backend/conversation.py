import logging
import uuid

from quart import (
    jsonify,
    make_response,
    request,
)

from backend.auth.auth_utils import get_authenticated_user_details
from azure.monitor.events.extension import track_event

# This import is not being used.
#from azure.search.documents.indexes.models import *

from backend.setup import MONITORING_ENABLED, SHOULD_STREAM, generate_title, init_cosmosdb_client, init_cosmosdb_logs_client, init_openai_client, prepare_model_args
from backend.utils import format_as_ndjson, format_stream_response, format_non_streaming_response

# The function below sends a chat request to the OpenAI API.
# It prepares the model arguments and sends the request to the OpenAI API.
async def send_chat_request(request):
    model_args = prepare_model_args(request)
    print(f"MODEL ARGS: {model_args}")
    try:
        azure_openai_client = init_openai_client()
        response = await azure_openai_client.chat.completions.create(**model_args)
    except Exception as e:
        print(f"Exception in send_chat_request {e}")
        logging.exception("Exception in send_chat_request")
        raise e

    return response

# The function below handles the conversation request from the user.
async def complete_chat_request(request_body):
    response = await send_chat_request(request_body)
    history_metadata = request_body.get("history_metadata", {})

    return format_non_streaming_response(response, history_metadata)

# The function below handles the stream conversation request from the user.
async def stream_chat_request(request_body):
    response = await send_chat_request(request_body)
    
    history_metadata = request_body.get("history_metadata", {})
    async def generate():
        async for completionChunk in response:
            formattedChunk = format_stream_response(completionChunk, history_metadata)
            # TO DO - RETRY INSTEAD OF PASSING ERROR
            yield formattedChunk

    return generate()

# The function below handles the conversation request from the user.
async def conversation_internal(request_body):
    try:
        if SHOULD_STREAM:
            result = await stream_chat_request(request_body)
            response = await make_response(format_as_ndjson(result))
            response.timeout = None
            response.mimetype = "application/json-lines"
            return response
        else:
            result = await complete_chat_request(request_body)
            return jsonify(result)
    
    except Exception as ex:
        print(f"Exception in conversation_internal {ex}")
        logging.exception(ex)
        if hasattr(ex, "status_code"):
            return jsonify({"error": str(ex)}), ex.status_code
        else:
            return jsonify({"error": str(ex)}), 500

# The function below adds a conversation to the CosmosDB database.
# It retrieves the conversation ID from the request body, validates it, and adds the conversation to the database.
async def add_conversation():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get('conversation_id', None)

    try:
        # make sure cosmos is configured
        cosmos_conversation_client = init_cosmosdb_client()
        if not cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")
        
        cosmos_logs_client = init_cosmosdb_logs_client()
        if not cosmos_logs_client:
            raise Exception("CosmosDB logs is not configured or not working")

        # check for the conversation_id, if the conversation is not set, we will create a new one
        history_metadata = {}
        if not conversation_id:
            title = await generate_title(request_json["messages"])
            conversation_dict = await cosmos_conversation_client.create_conversation(user_id=user_id, title=title)
            conversation_id = conversation_dict['id']
            logs_dict = await cosmos_logs_client.create_log_conversation(user_id=user_id, conversation_id=conversation_id, title=title)
            history_metadata['title'] = title
            history_metadata['date'] = conversation_dict['createdAt']

        ## Format the incoming message object in the "chat/completions" messages format
        ## then write it to the conversation history in cosmos and logs
        messageUuid = str(uuid.uuid4())
        messages = request_json["messages"]
        if len(messages) > 0 and messages[-1]['role'] == "user":
            createdMessageValue = await cosmos_conversation_client.create_message(
                uuid=messageUuid,
                conversation_id=conversation_id,
                user_id=user_id,
                input_message=messages[-1],
                hidden=messages[-1]['hidden']
            )
            if createdMessageValue == "Conversation not found":
                raise Exception("Conversation not found for the given conversation ID: " + conversation_id + ".")
            
            createdLogMessageValue = await cosmos_logs_client.create_message(
                uuid=messageUuid,
                conversation_id=conversation_id,
                user_id=user_id,
                input_message=messages[-1],
                hidden=messages[-1]['hidden']
            )
            if createdLogMessageValue == "Conversation not found":
                raise Exception("Conversation log not found for the given conversation ID: " + conversation_id + ".")

        else:
            raise Exception("No user message found")
        await cosmos_conversation_client.cosmosdb_client.close()
        await cosmos_logs_client.cosmosdb_client.close()
        
        # Submit request to Chat Completions for response
        request_body = await request.get_json()
        history_metadata['conversation_id'] = conversation_id
        request_body['history_metadata'] = history_metadata

        return await conversation_internal(request_body)
    except Exception as e:
        print(f"Exception in /history/generate: {e}")
        logging.exception("Exception in /history/generate")
        return jsonify({"error": str(e)}), 500

# The function below updates the conversation history in CosmosDB with the latest messages.
# It retrieves the conversation ID and messages from the request body, validates them, and updates the conversation history in the database.
async def update_conversation():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']
    if MONITORING_ENABLED:
        track_event("New-message", {"user": user_id, "key2": "value2"})

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get('conversation_id', None)

    try:
        # make sure cosmos is configured
        cosmos_conversation_client = init_cosmosdb_client()
        if not cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")
        
        cosmos_log_client = init_cosmosdb_logs_client()
        if not cosmos_log_client:
            raise Exception("CosmosDB logs is not configured or not working")

        # check for the conversation_id, if the conversation is not set, we will create a new one
        if not conversation_id:
            raise Exception("No conversation_id found")

        ## Format the incoming message object in the "chat/completions" messages format
        ## then write it to the conversation history in cosmos
        messages = request_json["messages"]
        if len(messages) > 0 and messages[-1]['role'] == "assistant":
            if len(messages) > 1 and messages[-2].get('role', None) == "tool":
                # write the tool message first
                toolMessageUuid = str(uuid.uuid4())
                await cosmos_conversation_client.create_message(
                    uuid=toolMessageUuid,
                    conversation_id=conversation_id,
                    user_id=user_id,
                    input_message=messages[-2]
                )
                await cosmos_log_client.create_message(
                    uuid=toolMessageUuid,
                    conversation_id=conversation_id,
                    user_id=user_id,
                    input_message=messages[-2]
                )
            # write the assistant message
            await cosmos_conversation_client.create_message(
                uuid=messages[-1]['id'],
                conversation_id=conversation_id,
                user_id=user_id,
                input_message=messages[-1]
            )
            await cosmos_log_client.create_message(
                uuid=messages[-1]['id'],
                conversation_id=conversation_id,
                user_id=user_id,
                input_message=messages[-1]
            )

        else:
            print(f"no assistant message found ")
            raise Exception("No bot messages found")
        
        # Submit request to Chat Completions for response
        await cosmos_conversation_client.cosmosdb_client.close()
        await cosmos_log_client.cosmosdb_client.close()
        response = {'success': True}
        return jsonify(response), 200
       
    except Exception as e:
        print(f"Exception in /history/update: {e}")
        logging.exception("Exception in /history/update")
        return jsonify({"error": str(e)}), 500

# The function below updates the feedback for a specific message in CosmosDB.
# It retrieves the message ID and feedback from the request body, validates them and updates the feedback for the specified message in the database.
# If the update is successful, it returns a success response; otherwise, it returns an error.
async def update_message():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']
    cosmos_conversation_client = init_cosmosdb_client()

    ## check request for message_id
    request_json = await request.get_json()
    message_id = request_json.get('message_id', None)
    message_feedback = request_json.get("message_feedback", None)
    try:
        if not message_id:
            return jsonify({"error": "message_id is required"}), 400
        
        if not message_feedback:
            return jsonify({"error": "message_feedback is required"}), 400
        
        ## update the message in cosmos
        updated_message = await cosmos_conversation_client.update_message_feedback(user_id, message_id, message_feedback)
        if updated_message:
            return jsonify({"message": f"Successfully updated message with feedback {message_feedback}", "message_id": message_id}), 200
        else:
            return jsonify({"error": f"Unable to update message {message_id}. It either does not exist or the user does not have access to it."}), 404
        
    except Exception as e:
        logging.exception("Exception in /history/message_feedback")
        return jsonify({"error": str(e)}), 500

# The function below deletes a conversation and its messages when specified by the user.
async def delete_conversation():

    ## get the user id from the request headers
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']
    if MONITORING_ENABLED:
        track_event("Delete-convo", {"user": user_id, "key2": "value2"})
    
    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get('conversation_id', None)

    try: 
        if not conversation_id:
            return jsonify({"error": "conversation_id is required"}), 400
        
        ## make sure cosmos is configured
        cosmos_conversation_client = init_cosmosdb_client()
        if not cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")

        ## delete the conversation messages from cosmos first
        deleted_messages = await cosmos_conversation_client.delete_messages(conversation_id, user_id)

        ## Now delete the conversation 
        deleted_conversation = await cosmos_conversation_client.delete_conversation(user_id, conversation_id)

        await cosmos_conversation_client.cosmosdb_client.close()

        return jsonify({"message": "Successfully deleted conversation and messages", "conversation_id": conversation_id}), 200
    except Exception as e:
        logging.exception("Exception in /history/delete")
        return jsonify({"error": str(e)}), 500

# The function below lists all conversations for a user.
async def list_conversations():
    offset = request.args.get("offset", 0)
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']

    ## make sure cosmos is configured
    cosmos_conversation_client = init_cosmosdb_client()
    if not cosmos_conversation_client:
        raise Exception("CosmosDB is not configured or not working")

    ## get the conversations from cosmos
    conversations = await cosmos_conversation_client.get_conversations(user_id, offset=offset, limit=25)
    await cosmos_conversation_client.cosmosdb_client.close()
    if not isinstance(conversations, list):
        return jsonify({"error": f"No conversations for {user_id} were found"}), 404

    ## return the conversation ids

    return jsonify(conversations), 200

# The function below gets a conversation from the user and its messages by doing a lookup in CosmosDB and returning the messages in the bot frontend format.
async def get_conversation():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get('conversation_id', None)
    
    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400
    
    ## make sure cosmos is configured
    cosmos_conversation_client = init_cosmosdb_client()
    if not cosmos_conversation_client:
        raise Exception("CosmosDB is not configured or not working")

    ## get the conversation object and the related messages from cosmos
    conversation = await cosmos_conversation_client.get_conversation(user_id, conversation_id)
    ## return the conversation id and the messages in the bot frontend format
    if not conversation:
        return jsonify({"error": f"Conversation {conversation_id} was not found. It either does not exist or the logged in user does not have access to it."}), 404
    
    # get the messages for the conversation from cosmos
    conversation_messages = await cosmos_conversation_client.get_messages(user_id, conversation_id)
        
    ## format the messages in the bot frontend format
    messages = [
        {
            'id': msg['id'],
            'role': msg['role'],
            'content': msg['content'],
            'createdAt': msg['createdAt'],
            'feedback': msg.get('feedback'),
            'hidden': msg.get('hidden')
        }
        for msg in conversation_messages
    ]

    await cosmos_conversation_client.cosmosdb_client.close()
    return jsonify({"conversation_id": conversation_id, "messages": messages}), 200

# The function below renames a conversation.
async def rename_conversation():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get('conversation_id', None)
    
    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400
    
    ## make sure cosmos is configured
    cosmos_conversation_client = init_cosmosdb_client()
    if not cosmos_conversation_client:
        raise Exception("CosmosDB is not configured or not working")
    
    ## get the conversation from cosmos
    conversation = await cosmos_conversation_client.get_conversation(user_id, conversation_id)
    if not conversation:
        return jsonify({"error": f"Conversation {conversation_id} was not found. It either does not exist or the logged in user does not have access to it."}), 404

    ## update the title
    title = request_json.get("title", None)
    if not title:
        return jsonify({"error": "title is required"}), 400
    conversation['title'] = title
    updated_conversation = await cosmos_conversation_client.upsert_conversation(conversation)

    await cosmos_conversation_client.cosmosdb_client.close()
    return jsonify(updated_conversation), 200

# The function below deletes all conversations for a user.
async def delete_all_conversations():
    ## get the user id from the request headers
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']

    # get conversations for user
    try:
        ## make sure cosmos is configured
        cosmos_conversation_client = init_cosmosdb_client()
        if not cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")

        conversations = await cosmos_conversation_client.get_conversations(user_id, offset=0, limit=None)
        if not conversations:
            return jsonify({"error": f"No conversations for {user_id} were found"}), 404
        
        # delete each conversation
        for conversation in conversations:
            ## delete the conversation messages from cosmos first
            deleted_messages = await cosmos_conversation_client.delete_messages(conversation['id'], user_id)

            ## Now delete the conversation 
            deleted_conversation = await cosmos_conversation_client.delete_conversation(user_id, conversation['id'])
        await cosmos_conversation_client.cosmosdb_client.close()
        return jsonify({"message": f"Successfully deleted conversation and messages for user {user_id}"}), 200
    
    except Exception as e:
        logging.exception("Exception in /history/delete_all")
        return jsonify({"error": str(e)}), 500

# The function below clears all messages in a conversation.
async def clear_messages():
    ## get the user id from the request headers
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']
    
    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get('conversation_id', None)

    try: 
        if not conversation_id:
            return jsonify({"error": "conversation_id is required"}), 400
        
        ## make sure cosmos is configured
        cosmos_conversation_client = init_cosmosdb_client()
        if not cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")

        ## delete the conversation messages from cosmos
        deleted_messages = await cosmos_conversation_client.delete_messages(conversation_id, user_id)

        return jsonify({"message": "Successfully deleted messages in conversation", "conversation_id": conversation_id}), 200
    except Exception as e:
        logging.exception("Exception in /history/clear_messages")
        return jsonify({"error": str(e)}), 500


