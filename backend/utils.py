import os
import json
import logging
from docx import Document
import requests
import dataclasses
from pypdf import PdfReader

DEBUG = os.environ.get("DEBUG", "false")
if DEBUG.lower() == "true":
    logging.basicConfig(level=logging.DEBUG)

AZURE_SEARCH_PERMITTED_GROUPS_COLUMN = os.environ.get("AZURE_SEARCH_PERMITTED_GROUPS_COLUMN")

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)
        return super().default(o)

async def format_as_ndjson(r):
    try:
        async for event in r:
            yield json.dumps(event, cls=JSONEncoder) + "\n"
    except Exception as error:
        logging.exception("Exception while generating response stream: %s", error)
        yield json.dumps({"error": str(error)})

def parse_multi_columns(columns: str) -> list:
    if "|" in columns:
        return columns.split("|")
    else:
        return columns.split(",")


def fetchUserGroups(userToken, nextLink=None):
    # Recursively fetch group membership
    if nextLink:
        endpoint = nextLink
    else:
        endpoint = "https://graph.microsoft.com/v1.0/me/transitiveMemberOf?$select=id"
    
    headers = {
        'Authorization': "bearer " + userToken
    }
    try :
        r = requests.get(endpoint, headers=headers)
        if r.status_code != 200:
            logging.error(f"Error fetching user groups: {r.status_code} {r.text}")
            return []
        
        r = r.json()
        if "@odata.nextLink" in r:
            nextLinkData = fetchUserGroups(userToken, r["@odata.nextLink"])
            r['value'].extend(nextLinkData)
        
        return r['value']
    except Exception as e:
        logging.error(f"Exception in fetchUserGroups: {e}")
        return []


def generateFilterString(userToken):
    # Get list of groups user is a member of
    userGroups = fetchUserGroups(userToken)

    # Construct filter string
    if not userGroups:
        logging.debug("No user groups found")

    group_ids = ", ".join([obj['id'] for obj in userGroups])
    return f"{AZURE_SEARCH_PERMITTED_GROUPS_COLUMN}/any(g:search.in(g, '{group_ids}'))"

def generateSimpleFilterString(user_id, filenames):
        # Construct filter string
    user_filter = f"user_id eq '{user_id}'"
    filename_filters = [f"filename eq '{filename}'" for filename in filenames]
    filename_filter = " or ".join(filename_filters)
    
    # Combine user_id filter and filename filters
    combined_filter = f"({user_filter}) and ({filename_filter})"
    
    return combined_filter



def format_non_streaming_response(chatCompletion, history_metadata, message_uuid=None):
    response_obj = {
        "id": chatCompletion.id,
        "model": chatCompletion.model,
        "created": chatCompletion.created,
        "object": chatCompletion.object,
        "choices": [
            {
                "messages": []
            }
        ],
        "history_metadata": history_metadata
    }

    if len(chatCompletion.choices) > 0:
        message = chatCompletion.choices[0].message
        if message:
            if hasattr(message, "context"):
                response_obj["choices"][0]["messages"].append({
                    "role": "tool",
                    "content": json.dumps(message.context),
                })
            response_obj["choices"][0]["messages"].append({
                "role": "assistant",
                "content": message.content,
            })
            return response_obj
    
    return {}

def format_stream_response(chatCompletionChunk, history_metadata, message_uuid=None):
    response_obj = {
        "id": chatCompletionChunk.id,
        "model": chatCompletionChunk.model,
        "created": chatCompletionChunk.created,
        "object": chatCompletionChunk.object,
        "choices": [{
            "messages": []
        }],
        "history_metadata": history_metadata
    }
    if len(chatCompletionChunk.choices) > 0:
        delta = chatCompletionChunk.choices[0].delta
        if delta:
            if hasattr(delta, "context"):
                if delta.context['citations'] == []:
                    return 'retry'
                    # raise Exception("An unexpected error occurred, please resubmit your question.")
                else:
                    messageObj = {
                        "role": "tool",
                        "content": json.dumps(delta.context)
                    }
                response_obj["choices"][0]["messages"].append(messageObj)
                return response_obj
            if delta.role == "assistant" and hasattr(delta, "context"):
                messageObj = {
                    "role": "assistant",
                    "context": delta.context,
                }
                response_obj["choices"][0]["messages"].append(messageObj)
                return response_obj
            else:
                if delta.content:
                    messageObj = {
                        "role": "assistant",
                        "content": delta.content,
                    }
                    response_obj["choices"][0]["messages"].append(messageObj)
                    return response_obj
    return {}


def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        reader = PdfReader(pdf_path)
        for page_num in range(len(reader.pages)):
            page = reader.pages[page_num]
            text += page.extract_text()
    except Exception as e:
        print(f"An error occurred: {e}")
    return text


def extract_text_from_txt(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            text = file.read()
    except Exception as e:
        print(f"An error occurred: {e}")
        text = ""
    return text

def extract_text_from_docx(file_path):
    try:
        doc = Document(file_path)
        text = []
        for paragraph in doc.paragraphs:
            text.append(paragraph.text)
        return '\n'.join(text)
    except Exception as e:
        print(f"An error occurred: {e}")
        return ""