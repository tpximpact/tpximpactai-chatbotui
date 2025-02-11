import os
import json
import logging
import re
import unicodedata
import requests
import dataclasses

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


def secure_filename(filename: str) -> str:
    r"""
    Adapted from werkzeug.utils.secure_filename to allow spaces in filenames
    
    Pass it a filename and it will return a secure version of it.  This
    filename can then safely be stored on a regular file system and passed
    to :func:`os.path.join`.  The filename returned is an ASCII only string
    for maximum portability.

    On windows systems the function also makes sure that the file is not
    named after one of the special device files.

    >>> secure_filename("My cool movie.mov")
    'My cool movie.mov'
    >>> secure_filename("../../../etc/passwd")
    'etc passwd'
    >>> secure_filename('i contain cool \xfcml\xe4uts.txt')
    'i contain cool umlauts.txt'

    The function might return an empty filename.  It's your responsibility
    to ensure that the filename is unique and that you abort or
    generate a random filename if the function returned an empty one.
    """
    # ... existing code ...
    _filename_ascii_strip_re = re.compile(r"[^A-Za-z0-9 _.-]")  # Added space to allowed chars

    filename = unicodedata.normalize("NFKD", filename)
    filename = filename.encode("ascii", "ignore").decode("ascii")

    for sep in os.sep, os.path.altsep:
        if sep:
            filename = filename.replace(sep, " ")
    filename = str(_filename_ascii_strip_re.sub("", filename)).strip("._")  # Removed _join(split())

    # ... existing code ...
    if (
        os.name == "nt"
        and filename
        and filename.split(".")[0].upper() in _windows_device_files
    ):
        filename = f"_{filename}"

    return filename