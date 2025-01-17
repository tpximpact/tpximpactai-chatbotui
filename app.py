import json
import logging
from dotenv import load_dotenv

from quart import (
    Blueprint,
    Quart,
    websocket,
    jsonify,
    request,
    send_from_directory,
    render_template
)

from backend.auth.auth_utils import get_authenticated_user_details
from backend.conversation import clear_messages, conversation_internal, delete_all_conversations, delete_conversation, get_conversation, list_conversations, rename_conversation, update_conversation, update_message, add_conversation
from backend.document import delete_documents, documentsummary, get_documents, handle_document_refinement, handle_new_document, ingest_all_docs_from_storage, upload_documents
from backend.setup import UI_FAVICON, UI_TITLE, ensure_cosmos, frontend_settings

load_dotenv(override=True)

def create_app():
    app = Quart(__name__)
    app.register_blueprint(bp)
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    return app

bp = Blueprint("routes", __name__, static_folder="static", template_folder="static")


@bp.route("/")
async def index():
    return await render_template("index.html", title=UI_TITLE, favicon=UI_FAVICON)

@bp.route("/favicon.ico")
async def favicon():
    return await bp.send_static_file("favicon.ico")

@bp.route("/assets/<path:path>")
async def assets(path):
    return await send_from_directory("static/assets", path)


@bp.route("/conversation", methods=["POST"])
async def conversation():

    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    return await conversation_internal(request_json)

@bp.route("/frontend_settings", methods=["GET"])
def get_frontend_settings():
    try:
        return jsonify(frontend_settings), 200
    except Exception as e:
        logging.exception("Exception in /frontend_settings")
        return jsonify({"error": str(e)}), 500  

@bp.route("/history/generate", methods=["POST"])
async def history_generate():
    return await add_conversation()

@bp.route("/history/update", methods=["POST"])
async def history_update():
    return await update_conversation()

@bp.route("/history/message_feedback", methods=["POST"])
async def history_message_feedback():
    return await update_message()

@bp.route("/history/delete", methods=["DELETE"])
async def history_delete():
    return await delete_conversation()

@bp.route("/history/list", methods=["GET"])
async def history_list():
    return await list_conversations()

@bp.route("/history/read", methods=["POST"])
async def history_read():
    return await get_conversation()

@bp.route("/history/rename", methods=["POST"])
async def history_rename():
    return await rename_conversation()

@bp.route("/history/delete_all", methods=["DELETE"])
async def history_delete_all():
    return await delete_all_conversations()

@bp.route("/history/clear", methods=["POST"])
async def history_clear():
    return await clear_messages()

@bp.route("/history/ensure", methods=["GET"])
async def history_ensure():
    return await ensure_cosmos()

@bp.websocket('/documentsummary/refine')
async def refine_progress():
    try:
        data = await websocket.receive()
        data = json.loads(data)
        await handle_document_refinement(websocket, data)
    except Exception as e:
        print(f"Error reading document: {e}")
    finally:
        await websocket.close()

@bp.route("/documentsummary/reduce", methods=["POST"])
async def document_summary():
    return await documentsummary()

@bp.websocket('/process_documents')
async def process_documents():
    try:
        data = await websocket.receive()
        data = json.loads(data)
        await handle_new_document(websocket, data)
    except Exception as e:
        print(f"Error processing documents: {e}")
        await websocket.send(f"error: {e}")
    finally:
        await websocket.close()


@bp.route("/upload_documents", methods=["POST"])
async def upload_documents_route():
    return await upload_documents()


@bp.route("/get_documents", methods=["GET"])
async def get_documents_route():
    return await get_documents()


@bp.route("/delete_documents", methods=["POST"])
async def delete_documents_route():
    return await delete_documents()

@bp.route("/get_user_id", methods=["GET"])
async def get_user_id():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    return jsonify(authenticated_user['user_principal_id']), 200

@bp.route("/ingest_all", methods=["GET"])
async def ingest_all():
    return await ingest_all_docs_from_storage()

app = create_app()
