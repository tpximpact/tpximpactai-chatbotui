import copy
import json
import os
import random
import re
import logging
import shutil
import tempfile
from typing import List
from dotenv import load_dotenv

from langchain_openai import AzureOpenAIEmbeddings
from quart import (
    jsonify,
    request,
)

from openai import AsyncAzureOpenAI
from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
from backend.auth.auth_utils import get_authenticated_user_details
from backend.history.cosmosdbservice import CosmosConversationClient


import tiktoken


from azure.core.credentials import AzureKeyCredential
from azure.storage.blob import BlobServiceClient
from azure.storage.blob.aio import BlobClient as AsyncBlobClient
from azure.storage.blob import BlobClient

from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import *

from backend.utils import generateFilterString, generateSimpleFilterString, parse_multi_columns
from opentelemetry.trace import SpanKind
from opentelemetry import trace
from opentelemetry import metrics
from azure.monitor.opentelemetry import configure_azure_monitor
from azure.monitor.events.extension import track_event

from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_core.documents import Document
from langchain_community.vectorstores.azuresearch import AzureSearch
from langchain_community.retrievers import AzureCognitiveSearchRetriever

MONITORING_ENABLED = False
if MONITORING_ENABLED:
    configure_azure_monitor(connection_string= os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING"))
    tracer = trace.get_tracer(__name__)
    meter = metrics.get_meter_provider().get_meter("otel_azure_monitor_counter_demo")
    counter = meter.create_counter("counter")

from backend.utils import generateFilterString, parse_multi_columns


# Current minimum Azure OpenAI version supported
MINIMUM_SUPPORTED_AZURE_OPENAI_PREVIEW_API_VERSION="2024-02-15-preview"

# UI configuration (optional)
UI_TITLE = os.environ.get("UI_TITLE")
UI_LOGO = os.environ.get("UI_LOGO")
UI_CHAT_LOGO = os.environ.get("UI_CHAT_LOGO")
UI_CHAT_PRE_TITLE = os.environ.get("UI_CHAT_PRE_TITLE") or "Welcome to"
UI_CHAT_TITLE = os.environ.get("UI_CHAT_TITLE") or "ImpactAI"
UI_CHAT_DESCRIPTION = os.environ.get("UI_CHAT_DESCRIPTION")
UI_FAVICON = os.environ.get("UI_FAVICON") or "/favicon.ico"
UI_SHOW_SHARE_BUTTON = os.environ.get("UI_SHOW_SHARE_BUTTON", "true").lower() == "true"




# Dev mode
DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"

# Debug settings
DEBUG = os.environ.get("DEBUG", "false")
if DEBUG.lower() == "true":
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.WARNING)  # Change from DEBUG to WARNING or INFO
azure_logger = logging.getLogger('azure.core.pipeline.policies.http_logging_policy')
azure_logger.setLevel(logging.WARNING)  # or logging.ERROR for even less logging


USER_AGENT = "GitHubSampleWebApp/AsyncAzureOpenAI/1.0.0"

# On Your Data Settings
DATASOURCE_TYPE = os.environ.get("DATASOURCE_TYPE", "AzureCognitiveSearch")
SEARCH_TOP_K = os.environ.get("SEARCH_TOP_K", 5)
SEARCH_STRICTNESS = os.environ.get("SEARCH_STRICTNESS", 3)
SEARCH_ENABLE_IN_DOMAIN = os.environ.get("SEARCH_ENABLE_IN_DOMAIN", "true")

# Document storage settings
AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT")
AZURE_STORAGE_KEY = os.environ.get("AZURE_STORAGE_KEY")


# ACS Integration Settings
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE")
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX")
AZURE_SEARCH_KEY = os.environ.get("AZURE_SEARCH_KEY", None)
AZURE_SEARCH_USE_SEMANTIC_SEARCH = os.environ.get("AZURE_SEARCH_USE_SEMANTIC_SEARCH", "false")
AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG = os.environ.get("AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG", "default")
AZURE_SEARCH_TOP_K = os.environ.get("AZURE_SEARCH_TOP_K", SEARCH_TOP_K)
AZURE_SEARCH_ENABLE_IN_DOMAIN = os.environ.get("AZURE_SEARCH_ENABLE_IN_DOMAIN", SEARCH_ENABLE_IN_DOMAIN)
AZURE_SEARCH_CONTENT_COLUMNS = os.environ.get("AZURE_SEARCH_CONTENT_COLUMNS")
AZURE_SEARCH_FILENAME_COLUMN = os.environ.get("AZURE_SEARCH_FILENAME_COLUMN")
AZURE_SEARCH_TITLE_COLUMN = os.environ.get("AZURE_SEARCH_TITLE_COLUMN")
AZURE_SEARCH_URL_COLUMN = os.environ.get("AZURE_SEARCH_URL_COLUMN")
AZURE_SEARCH_VECTOR_COLUMNS = os.environ.get("AZURE_SEARCH_VECTOR_COLUMNS")
AZURE_SEARCH_QUERY_TYPE = os.environ.get("AZURE_SEARCH_QUERY_TYPE")
AZURE_SEARCH_PERMITTED_GROUPS_COLUMN = os.environ.get("AZURE_SEARCH_PERMITTED_GROUPS_COLUMN")
AZURE_SEARCH_STRICTNESS = os.environ.get("AZURE_SEARCH_STRICTNESS", SEARCH_STRICTNESS)

# AOAI Integration Settings
AZURE_OPENAI_RESOURCE = os.environ.get("AZURE_OPENAI_RESOURCE")
AZURE_OPENAI_MODEL = os.environ.get("AZURE_OPENAI_MODEL")
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY")
AZURE_OPENAI_TEMPERATURE = os.environ.get("AZURE_OPENAI_TEMPERATURE", 0)
AZURE_OPENAI_TOP_P = os.environ.get("AZURE_OPENAI_TOP_P", 1.0)
AZURE_OPENAI_MAX_TOKENS = os.environ.get("AZURE_OPENAI_MAX_TOKENS", 1000)
AZURE_OPENAI_STOP_SEQUENCE = os.environ.get("AZURE_OPENAI_STOP_SEQUENCE")
AZURE_OPENAI_SYSTEM_MESSAGE = os.environ.get("AZURE_OPENAI_SYSTEM_MESSAGE", "You are an AI assistant that helps people find information.")
AZURE_OPENAI_PREVIEW_API_VERSION = os.environ.get("AZURE_OPENAI_PREVIEW_API_VERSION", MINIMUM_SUPPORTED_AZURE_OPENAI_PREVIEW_API_VERSION)
AZURE_OPENAI_STREAM = os.environ.get("AZURE_OPENAI_STREAM", "true")
AZURE_OPENAI_MODEL_NAME = os.environ.get("AZURE_OPENAI_MODEL_NAME", "gpt-35-turbo-16k") # Name of the model, e.g. 'gpt-35-turbo-16k' or 'gpt-4'
AZURE_OPENAI_EMBEDDING_ENDPOINT = os.environ.get("AZURE_OPENAI_EMBEDDING_ENDPOINT")
AZURE_OPENAI_EMBEDDING_KEY = os.environ.get("AZURE_OPENAI_EMBEDDING_KEY")
AZURE_OPENAI_EMBEDDING_NAME = os.environ.get("AZURE_OPENAI_EMBEDDING_NAME", "")
AZURE_OPENAI_EMBEDDING_MODEL_NAME = os.environ.get("AZURE_OPENAI_EMBEDDING_MODEL_NAME")

# CosmosDB Mongo vcore vector db Settings
AZURE_COSMOSDB_MONGO_VCORE_CONNECTION_STRING = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_CONNECTION_STRING")  #This has to be secure string
AZURE_COSMOSDB_MONGO_VCORE_DATABASE = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_DATABASE")
AZURE_COSMOSDB_MONGO_VCORE_CONTAINER = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_CONTAINER")
AZURE_COSMOSDB_MONGO_VCORE_INDEX = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_INDEX")
AZURE_COSMOSDB_MONGO_VCORE_TOP_K = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_TOP_K", AZURE_SEARCH_TOP_K)
AZURE_COSMOSDB_MONGO_VCORE_STRICTNESS = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_STRICTNESS", AZURE_SEARCH_STRICTNESS)  
AZURE_COSMOSDB_MONGO_VCORE_ENABLE_IN_DOMAIN = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_ENABLE_IN_DOMAIN", AZURE_SEARCH_ENABLE_IN_DOMAIN)
AZURE_COSMOSDB_MONGO_VCORE_CONTENT_COLUMNS = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_CONTENT_COLUMNS", "")
AZURE_COSMOSDB_MONGO_VCORE_FILENAME_COLUMN = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_FILENAME_COLUMN")
AZURE_COSMOSDB_MONGO_VCORE_TITLE_COLUMN = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_TITLE_COLUMN")
AZURE_COSMOSDB_MONGO_VCORE_URL_COLUMN = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_URL_COLUMN")
AZURE_COSMOSDB_MONGO_VCORE_VECTOR_COLUMNS = os.environ.get("AZURE_COSMOSDB_MONGO_VCORE_VECTOR_COLUMNS")

SHOULD_STREAM = True if AZURE_OPENAI_STREAM.lower() == "true" else False

# Chat History CosmosDB Integration Settings
AZURE_COSMOSDB_DATABASE = os.environ.get("AZURE_COSMOSDB_DATABASE")
AZURE_COSMOSDB_ACCOUNT = os.environ.get("AZURE_COSMOSDB_ACCOUNT")
AZURE_COSMOSDB_CONVERSATIONS_CONTAINER = os.environ.get("AZURE_COSMOSDB_CONVERSATIONS_CONTAINER")
AZURE_COSMOSDB_ACCOUNT_KEY = os.environ.get("AZURE_COSMOSDB_ACCOUNT_KEY")
AZURE_COSMOSDB_ENABLE_FEEDBACK = os.environ.get("AZURE_COSMOSDB_ENABLE_FEEDBACK", "false").lower() == "true"

# Elasticsearch Integration Settings
ELASTICSEARCH_ENDPOINT = os.environ.get("ELASTICSEARCH_ENDPOINT")
ELASTICSEARCH_ENCODED_API_KEY = os.environ.get("ELASTICSEARCH_ENCODED_API_KEY")
ELASTICSEARCH_INDEX = os.environ.get("ELASTICSEARCH_INDEX")
ELASTICSEARCH_QUERY_TYPE = os.environ.get("ELASTICSEARCH_QUERY_TYPE", "simple")
ELASTICSEARCH_TOP_K = os.environ.get("ELASTICSEARCH_TOP_K", SEARCH_TOP_K)
ELASTICSEARCH_ENABLE_IN_DOMAIN = os.environ.get("ELASTICSEARCH_ENABLE_IN_DOMAIN", SEARCH_ENABLE_IN_DOMAIN)
ELASTICSEARCH_CONTENT_COLUMNS = os.environ.get("ELASTICSEARCH_CONTENT_COLUMNS")
ELASTICSEARCH_FILENAME_COLUMN = os.environ.get("ELASTICSEARCH_FILENAME_COLUMN")
ELASTICSEARCH_TITLE_COLUMN = os.environ.get("ELASTICSEARCH_TITLE_COLUMN")
ELASTICSEARCH_URL_COLUMN = os.environ.get("ELASTICSEARCH_URL_COLUMN")
ELASTICSEARCH_VECTOR_COLUMNS = os.environ.get("ELASTICSEARCH_VECTOR_COLUMNS")
ELASTICSEARCH_STRICTNESS = os.environ.get("ELASTICSEARCH_STRICTNESS", SEARCH_STRICTNESS)
ELASTICSEARCH_EMBEDDING_MODEL_ID = os.environ.get("ELASTICSEARCH_EMBEDDING_MODEL_ID")

# Pinecone Integration Settings
PINECONE_ENVIRONMENT = os.environ.get("PINECONE_ENVIRONMENT")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME")
PINECONE_TOP_K = os.environ.get("PINECONE_TOP_K", SEARCH_TOP_K)
PINECONE_STRICTNESS = os.environ.get("PINECONE_STRICTNESS", SEARCH_STRICTNESS)  
PINECONE_ENABLE_IN_DOMAIN = os.environ.get("PINECONE_ENABLE_IN_DOMAIN", SEARCH_ENABLE_IN_DOMAIN)
PINECONE_CONTENT_COLUMNS = os.environ.get("PINECONE_CONTENT_COLUMNS", "")
PINECONE_FILENAME_COLUMN = os.environ.get("PINECONE_FILENAME_COLUMN")
PINECONE_TITLE_COLUMN = os.environ.get("PINECONE_TITLE_COLUMN")
PINECONE_URL_COLUMN = os.environ.get("PINECONE_URL_COLUMN")
PINECONE_VECTOR_COLUMNS = os.environ.get("PINECONE_VECTOR_COLUMNS")

# Azure AI MLIndex Integration Settings - for use with MLIndex data assets created in Azure AI Studio
AZURE_MLINDEX_NAME = os.environ.get("AZURE_MLINDEX_NAME")
AZURE_MLINDEX_VERSION = os.environ.get("AZURE_MLINDEX_VERSION")
AZURE_ML_PROJECT_RESOURCE_ID = os.environ.get("AZURE_ML_PROJECT_RESOURCE_ID") # /subscriptions/{sub ID}/resourceGroups/{rg name}/providers/Microsoft.MachineLearningServices/workspaces/{AML project name}
AZURE_MLINDEX_TOP_K = os.environ.get("AZURE_MLINDEX_TOP_K", SEARCH_TOP_K)
AZURE_MLINDEX_STRICTNESS = os.environ.get("AZURE_MLINDEX_STRICTNESS", SEARCH_STRICTNESS)  
AZURE_MLINDEX_ENABLE_IN_DOMAIN = os.environ.get("AZURE_MLINDEX_ENABLE_IN_DOMAIN", SEARCH_ENABLE_IN_DOMAIN)
AZURE_MLINDEX_CONTENT_COLUMNS = os.environ.get("AZURE_MLINDEX_CONTENT_COLUMNS", "")
AZURE_MLINDEX_FILENAME_COLUMN = os.environ.get("AZURE_MLINDEX_FILENAME_COLUMN")
AZURE_MLINDEX_TITLE_COLUMN = os.environ.get("AZURE_MLINDEX_TITLE_COLUMN")
AZURE_MLINDEX_URL_COLUMN = os.environ.get("AZURE_MLINDEX_URL_COLUMN")
AZURE_MLINDEX_VECTOR_COLUMNS = os.environ.get("AZURE_MLINDEX_VECTOR_COLUMNS")
AZURE_MLINDEX_QUERY_TYPE = os.environ.get("AZURE_MLINDEX_QUERY_TYPE")


# Frontend Settings via Environment Variables
AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "true").lower() == "true"
CHAT_HISTORY_ENABLED = AZURE_COSMOSDB_ACCOUNT and AZURE_COSMOSDB_DATABASE and AZURE_COSMOSDB_CONVERSATIONS_CONTAINER
SANITIZE_ANSWER = os.environ.get("SANITIZE_ANSWER", "false").lower() == "true"

print('SEARCH ENABLE IN DOMAIN', SEARCH_ENABLE_IN_DOMAIN)
print('AZURE SEARCH ENABLE IN DOMAIN', AZURE_SEARCH_ENABLE_IN_DOMAIN)
frontend_settings = { 
    "auth_enabled": AUTH_ENABLED, 
    "feedback_enabled": AZURE_COSMOSDB_ENABLE_FEEDBACK and CHAT_HISTORY_ENABLED,
    "ui": {
        "title": UI_TITLE,
        "logo": UI_LOGO,
        "chat_logo": UI_CHAT_LOGO or UI_LOGO,
        "chat_pre_title": UI_CHAT_PRE_TITLE,
        "chat_title": UI_CHAT_TITLE,
        "chat_description": UI_CHAT_DESCRIPTION,
        "show_share_button": UI_SHOW_SHARE_BUTTON
    },
    "dev_mode": DEV_MODE,
    "sanitize_answer": SANITIZE_ANSWER
}

def should_use_data():
    global DATASOURCE_TYPE
    if AZURE_SEARCH_SERVICE and AZURE_SEARCH_INDEX:
        DATASOURCE_TYPE = "AzureCognitiveSearch"
        logging.debug("Using Azure Cognitive Search")
        return True
    
    if AZURE_COSMOSDB_MONGO_VCORE_DATABASE and AZURE_COSMOSDB_MONGO_VCORE_CONTAINER and AZURE_COSMOSDB_MONGO_VCORE_INDEX and AZURE_COSMOSDB_MONGO_VCORE_CONNECTION_STRING:
        DATASOURCE_TYPE = "AzureCosmosDB"
        logging.debug("Using Azure CosmosDB Mongo vcore")
        return True
    
    if ELASTICSEARCH_ENDPOINT and ELASTICSEARCH_ENCODED_API_KEY and ELASTICSEARCH_INDEX:
        DATASOURCE_TYPE = "Elasticsearch"
        logging.debug("Using Elasticsearch")
        return True
    
    if PINECONE_ENVIRONMENT and PINECONE_API_KEY and PINECONE_INDEX_NAME:
        DATASOURCE_TYPE = "Pinecone"
        logging.debug("Using Pinecone")
        return True
    
    if AZURE_MLINDEX_NAME and AZURE_MLINDEX_VERSION and AZURE_ML_PROJECT_RESOURCE_ID:
        DATASOURCE_TYPE = "AzureMLIndex"
        logging.debug("Using Azure ML Index")
        return True

    return False

SHOULD_USE_DATA = should_use_data()

# Initialize Azure OpenAI Client
def init_openai_client(use_data=SHOULD_USE_DATA):
    azure_openai_client = None
    try:
        # API version check
        if AZURE_OPENAI_PREVIEW_API_VERSION < MINIMUM_SUPPORTED_AZURE_OPENAI_PREVIEW_API_VERSION:
            raise Exception(f"The minimum supported Azure OpenAI preview API version is '{MINIMUM_SUPPORTED_AZURE_OPENAI_PREVIEW_API_VERSION}'")
        
        # Endpoint
        if not AZURE_OPENAI_ENDPOINT and not AZURE_OPENAI_RESOURCE:
            raise Exception("AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_RESOURCE is required")
        
        endpoint = AZURE_OPENAI_ENDPOINT if AZURE_OPENAI_ENDPOINT else f"https://{AZURE_OPENAI_RESOURCE}.openai.azure.com/"
        
        # Authentication
        aoai_api_key = AZURE_OPENAI_KEY
        ad_token_provider = None
        if not aoai_api_key:
            logging.debug("No AZURE_OPENAI_KEY found, using Azure AD auth")
            ad_token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")

        # Deployment
        deployment = AZURE_OPENAI_MODEL
        if not deployment:
            raise Exception("AZURE_OPENAI_MODEL is required")

        # Default Headers
        default_headers = {
            'x-ms-useragent': USER_AGENT
        }

        azure_openai_client = AsyncAzureOpenAI(
            api_version=AZURE_OPENAI_PREVIEW_API_VERSION,
            api_key=aoai_api_key,
            azure_ad_token_provider=ad_token_provider,
            default_headers=default_headers,
            azure_endpoint=endpoint
        )
            
        return azure_openai_client
    except Exception as e:
        logging.exception("Exception in Azure OpenAI initialization", e)
        azure_openai_client = None
        raise e

def init_embed_model():
    try:
        params = {
            "model": AZURE_OPENAI_EMBEDDING_MODEL_NAME,
            "azure_deployment": AZURE_OPENAI_EMBEDDING_NAME,
            "api_version": AZURE_OPENAI_PREVIEW_API_VERSION,
            "azure_endpoint": AZURE_OPENAI_ENDPOINT,
            "api_key": AZURE_OPENAI_KEY
        }

        embeddings = AzureOpenAIEmbeddings(**params)

        return embeddings
    except Exception as e:
        logging.exception("Exception in Azure OpenAI Embedding initialization", e)
        embeddings = None
        raise e



def init_cosmosdb_client():
    logging.debug("Initializing CosmosDB client")
    cosmos_conversation_client = None
    if CHAT_HISTORY_ENABLED:
        logging.debug("COSMOSDB ENABLED")
        try:
            cosmos_endpoint = f'https://{AZURE_COSMOSDB_ACCOUNT}.documents.azure.com:443/'

            if not AZURE_COSMOSDB_ACCOUNT_KEY:
                credential = DefaultAzureCredential()
            else:
                credential = AZURE_COSMOSDB_ACCOUNT_KEY

            cosmos_conversation_client = CosmosConversationClient(
                cosmosdb_endpoint=cosmos_endpoint, 
                credential=credential, 
                database_name=AZURE_COSMOSDB_DATABASE,
                container_name=AZURE_COSMOSDB_CONVERSATIONS_CONTAINER,
                enable_message_feedback=AZURE_COSMOSDB_ENABLE_FEEDBACK
            )
        except Exception as e:
            logging.exception("Exception in CosmosDB initialization", e)
            cosmos_conversation_client = None
            raise e
    else:
        logging.debug("CosmosDB not configured")
        
    return cosmos_conversation_client

def init_cosmosdb_logs_client():
    logging.debug("Initializing CosmosDB logs client")
    cosmos_logs_client = None
    if CHAT_HISTORY_ENABLED:
        logging.debug("COSMOSDB ENABLED")
        try:
            cosmos_endpoint = f'https://{AZURE_COSMOSDB_ACCOUNT}.documents.azure.com:443/'

            if not AZURE_COSMOSDB_ACCOUNT_KEY:
                credential = DefaultAzureCredential()
            else:
                credential = AZURE_COSMOSDB_ACCOUNT_KEY

            cosmos_logs_client = CosmosConversationClient(
                cosmosdb_endpoint=cosmos_endpoint, 
                credential=credential, 
                database_name=AZURE_COSMOSDB_DATABASE,
                container_name="logs",
                enable_message_feedback=AZURE_COSMOSDB_ENABLE_FEEDBACK
            )
        except Exception as e:
            logging.exception("Exception in CosmosDB logs initialization", e)
            cosmos_logs_client = None
            raise e
    else:
        logging.debug("CosmosDB logs not configured")
        
    return cosmos_logs_client


def init_container_client(storage_container_name):

    storage_account_url = f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/"

    blob_service_client = BlobServiceClient(
    account_url=storage_account_url, 
    credential=AZURE_STORAGE_KEY
    )

    container_client = blob_service_client.get_container_client(storage_container_name)
    return container_client

def init_search_client():
    search_client = None
    try:
        search_client = SearchClient(
            endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
            index_name=AZURE_SEARCH_INDEX,
            credential=AzureKeyCredential(AZURE_SEARCH_KEY)
        )
    except Exception as e:
        logging.exception("Exception in Azure Cognitive Search initialization", e)
        search_client = None
        raise e
        
    return search_client


def init_vector_store():
    # 'Python HTTP trigger function processed a request for CreateSearchIndex.'

    # """
    #     If the index already exists, then this function will update it and won't create a new one from scratch.
    #     If the updates are not compatible with the existing index, it will throw an error.
    # """
    embeddings = init_embed_model()

    try:
        # get the more static environment variables from the function app
        search_service_name = AZURE_SEARCH_SERVICE
        search_service_key = AZURE_SEARCH_KEY
        search_index_name = AZURE_SEARCH_INDEX

        # get Azure credentials
        # connect to Azure Cognitive Search resource
        service_endpoint = f"https://{search_service_name}.search.windows.net"

        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True, sortable=True),
            SearchableField(name="user_id", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="doc_url", type=SearchFieldDataType.String),
            SearchableField(name="filename", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SearchableField(name="content", type=SearchFieldDataType.String),
            SearchableField(name="chunk_number", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SearchField(
                name="content_vector", 
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True, 
                vector_search_dimensions=1536, 
                vector_search_profile_name="ll-vector-config"
            ),
            SearchableField(
                name="metadata",
                type=SearchFieldDataType.String,
                searchable=True,
            ),  

        ]

        # add a scoring profile to treat the content and vector with higher importance than question
        scoring_profiles = [
            {
                "name": "Hybrid",
                "functionAggregation": "sum",
                "text": {
                    "weights": {
                    "content": 100,
                    "content_vector": 100
                    }
                },
                "functions": []
            }
        ]

        vector_search = VectorSearch(
            profiles=[
                VectorSearchProfile(
                        name="ll-vector-config", 
                        algorithm_configuration_name="ll-algorithms-config"
                    )
                ],
                algorithms=[
                    HnswAlgorithmConfiguration(
                        name="ll-algorithms-config",
                        kind="hnsw",
                        parameters=HnswParameters(metric="cosine")
                    )
                ]
            )


        vector_store: AzureSearch = AzureSearch(
            azure_search_endpoint=service_endpoint,
            azure_search_key=search_service_key,
            index_name=search_index_name,
            embedding_function=embeddings.embed_query,
            additional_search_client_options={"retry_total": 4},
            fields=fields,
            vector_search=vector_search,
            scoring_profiles=scoring_profiles
        )

        print(f"Vector store initialised.")
        return vector_store
    
    except Exception as ex:
        logging.exception(f"Exception in vector store initialization", ex)
        print(f"Exception in vector store initialization", ex)
        raise ex


async def ensure_cosmos():
    if not AZURE_COSMOSDB_ACCOUNT:
        return jsonify({"error": "CosmosDB is not configured"}), 404
    
    try:
        cosmos_conversation_client = init_cosmosdb_client()
        success, err = await cosmos_conversation_client.ensure()
        if not cosmos_conversation_client or not success:
            if err:
                return jsonify({"error": err}), 422
            return jsonify({"error": "CosmosDB is not configured or not working"}), 500
        
        await cosmos_conversation_client.cosmosdb_client.close()
        return jsonify({"message": "CosmosDB is configured and working"}), 200
    except Exception as e:
        logging.exception("Exception in /history/ensure")
        cosmos_exception = str(e)
        if "Invalid credentials" in cosmos_exception:
            return jsonify({"error": cosmos_exception}), 401
        elif "Invalid CosmosDB database name" in cosmos_exception:
            return jsonify({"error": f"{cosmos_exception} {AZURE_COSMOSDB_DATABASE} for account {AZURE_COSMOSDB_ACCOUNT}"}), 422
        elif "Invalid CosmosDB container name" in cosmos_exception:
            return jsonify({"error": f"{cosmos_exception}: {AZURE_COSMOSDB_CONVERSATIONS_CONTAINER}"}), 422
        else:
            return jsonify({"error": "CosmosDB is not working"}), 500


def get_configured_data_source(user_id, filenames):
    data_source = {}
    query_type = "simple"
    if DATASOURCE_TYPE == "AzureCognitiveSearch":
        # Set query type
        if AZURE_SEARCH_QUERY_TYPE:
            query_type = AZURE_SEARCH_QUERY_TYPE
        elif AZURE_SEARCH_USE_SEMANTIC_SEARCH.lower() == "true" and AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG:
            query_type = "semantic"

        # Set filter
        filter = generateSimpleFilterString(user_id, filenames)
        userToken = None
        if AZURE_SEARCH_PERMITTED_GROUPS_COLUMN:
            userToken = request.headers.get('X-MS-TOKEN-AAD-ACCESS-TOKEN', "")
            logging.debug(f"USER TOKEN is {'present' if userToken else 'not present'}")
            if not userToken:
                raise Exception("Document-level access control is enabled, but user access token could not be fetched.")

            filter = generateFilterString(userToken)
            logging.debug(f"FILTER: {filter}")
        # Set authentication
        authentication = {}
        # if AZURE_SEARCH_KEY:
        #     authentication = {
        #         "type": "api_key",
        #         "api_key": AZURE_SEARCH_KEY
        #     }
        # else:
        # If key is not provided, assume AOAI resource identity has been granted access to the search service
        logging.debug("Using system-assigned managed identity for Azure Cognitive Search")
        authentication = {
            "type": "system_assigned_managed_identity"
        }

        data_source = {
                "type": "azure_search",
                "parameters": {
                    "endpoint": f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
                    "authentication": authentication,
                    "index_name": AZURE_SEARCH_INDEX,
                    "fields_mapping": {
                        "content_fields": parse_multi_columns(AZURE_SEARCH_CONTENT_COLUMNS) if AZURE_SEARCH_CONTENT_COLUMNS else [],
                        "title_field": AZURE_SEARCH_TITLE_COLUMN if AZURE_SEARCH_TITLE_COLUMN else None,
                        "url_field": AZURE_SEARCH_URL_COLUMN if AZURE_SEARCH_URL_COLUMN else None,
                        "filepath_field": AZURE_SEARCH_FILENAME_COLUMN if AZURE_SEARCH_FILENAME_COLUMN else None,
                        "vector_fields": parse_multi_columns(AZURE_SEARCH_VECTOR_COLUMNS) if AZURE_SEARCH_VECTOR_COLUMNS else []
                    },
                    "in_scope": True if AZURE_SEARCH_ENABLE_IN_DOMAIN.lower() == "true" else False,
                    "top_n_documents": int(AZURE_SEARCH_TOP_K) if AZURE_SEARCH_TOP_K else int(SEARCH_TOP_K),
                    "query_type": query_type,
                    "semantic_configuration": AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG if AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG else "",
                    "role_information": AZURE_OPENAI_SYSTEM_MESSAGE,
                    "filter": filter,
                    "strictness": int(AZURE_SEARCH_STRICTNESS) if AZURE_SEARCH_STRICTNESS else int(SEARCH_STRICTNESS)
                }
            }
    elif DATASOURCE_TYPE == "AzureCosmosDB":
        query_type = "vector"

        data_source = {
                "type": "azure_cosmos_db",
                "parameters": {
                    "authentication": {
                        "type": "connection_string",
                        "connection_string": AZURE_COSMOSDB_MONGO_VCORE_CONNECTION_STRING
                    },
                    "index_name": AZURE_COSMOSDB_MONGO_VCORE_INDEX,
                    "database_name": AZURE_COSMOSDB_MONGO_VCORE_DATABASE,
                    "container_name": AZURE_COSMOSDB_MONGO_VCORE_CONTAINER,                    
                    "fields_mapping": {
                        "content_fields": parse_multi_columns(AZURE_COSMOSDB_MONGO_VCORE_CONTENT_COLUMNS) if AZURE_COSMOSDB_MONGO_VCORE_CONTENT_COLUMNS else [],
                        "title_field": AZURE_COSMOSDB_MONGO_VCORE_TITLE_COLUMN if AZURE_COSMOSDB_MONGO_VCORE_TITLE_COLUMN else None,
                        "url_field": AZURE_COSMOSDB_MONGO_VCORE_URL_COLUMN if AZURE_COSMOSDB_MONGO_VCORE_URL_COLUMN else None,
                        "filepath_field": AZURE_COSMOSDB_MONGO_VCORE_FILENAME_COLUMN if AZURE_COSMOSDB_MONGO_VCORE_FILENAME_COLUMN else None,
                        "vector_fields": parse_multi_columns(AZURE_COSMOSDB_MONGO_VCORE_VECTOR_COLUMNS) if AZURE_COSMOSDB_MONGO_VCORE_VECTOR_COLUMNS else []
                    },
                    "in_scope": True if AZURE_COSMOSDB_MONGO_VCORE_ENABLE_IN_DOMAIN.lower() == "true" else False,
                    "top_n_documents": int(AZURE_COSMOSDB_MONGO_VCORE_TOP_K) if AZURE_COSMOSDB_MONGO_VCORE_TOP_K else int(SEARCH_TOP_K),
                    "strictness": int(AZURE_COSMOSDB_MONGO_VCORE_STRICTNESS) if AZURE_COSMOSDB_MONGO_VCORE_STRICTNESS else int(SEARCH_STRICTNESS),
                    "query_type": query_type,
                    "role_information": AZURE_OPENAI_SYSTEM_MESSAGE
                }
            }
    elif DATASOURCE_TYPE == "Elasticsearch":
        if ELASTICSEARCH_QUERY_TYPE:
            query_type = ELASTICSEARCH_QUERY_TYPE

        data_source = {
            "type": "elasticsearch",
            "parameters": {
                "endpoint": ELASTICSEARCH_ENDPOINT,
                "authentication": {
                    "type": "encoded_api_key",
                    "encoded_api_key": ELASTICSEARCH_ENCODED_API_KEY
                },
                "index_name": ELASTICSEARCH_INDEX,
                "fields_mapping": {
                    "content_fields": parse_multi_columns(ELASTICSEARCH_CONTENT_COLUMNS) if ELASTICSEARCH_CONTENT_COLUMNS else [],
                    "title_field": ELASTICSEARCH_TITLE_COLUMN if ELASTICSEARCH_TITLE_COLUMN else None,
                    "url_field": ELASTICSEARCH_URL_COLUMN if ELASTICSEARCH_URL_COLUMN else None,
                    "filepath_field": ELASTICSEARCH_FILENAME_COLUMN if ELASTICSEARCH_FILENAME_COLUMN else None,
                    "vector_fields": parse_multi_columns(ELASTICSEARCH_VECTOR_COLUMNS) if ELASTICSEARCH_VECTOR_COLUMNS else []
                },
                "in_scope": True if ELASTICSEARCH_ENABLE_IN_DOMAIN.lower() == "true" else False,
                "top_n_documents": int(ELASTICSEARCH_TOP_K) if ELASTICSEARCH_TOP_K else int(SEARCH_TOP_K),
                "query_type": query_type,
                "role_information": AZURE_OPENAI_SYSTEM_MESSAGE,
                "strictness": int(ELASTICSEARCH_STRICTNESS) if ELASTICSEARCH_STRICTNESS else int(SEARCH_STRICTNESS)
            }
        }
    elif DATASOURCE_TYPE == "AzureMLIndex":
        if AZURE_MLINDEX_QUERY_TYPE:
            query_type = AZURE_MLINDEX_QUERY_TYPE

        data_source = {
            "type": "azure_ml_index",
            "parameters": {
                "name": AZURE_MLINDEX_NAME,
                "version": AZURE_MLINDEX_VERSION,
                "project_resource_id": AZURE_ML_PROJECT_RESOURCE_ID,
                "fieldsMapping": {
                    "content_fields": parse_multi_columns(AZURE_MLINDEX_CONTENT_COLUMNS) if AZURE_MLINDEX_CONTENT_COLUMNS else [],
                    "title_field": AZURE_MLINDEX_TITLE_COLUMN if AZURE_MLINDEX_TITLE_COLUMN else None,
                    "url_field": AZURE_MLINDEX_URL_COLUMN if AZURE_MLINDEX_URL_COLUMN else None,
                    "filepath_field": AZURE_MLINDEX_FILENAME_COLUMN if AZURE_MLINDEX_FILENAME_COLUMN else None,
                    "vector_fields": parse_multi_columns(AZURE_MLINDEX_VECTOR_COLUMNS) if AZURE_MLINDEX_VECTOR_COLUMNS else []
                },
                "in_scope": True if AZURE_MLINDEX_ENABLE_IN_DOMAIN.lower() == "true" else False,
                "top_n_documents": int(AZURE_MLINDEX_TOP_K) if AZURE_MLINDEX_TOP_K else int(SEARCH_TOP_K),
                "query_type": query_type,
                "role_information": AZURE_OPENAI_SYSTEM_MESSAGE,
                "strictness": int(AZURE_MLINDEX_STRICTNESS) if AZURE_MLINDEX_STRICTNESS else int(SEARCH_STRICTNESS)
            }
        }
    elif DATASOURCE_TYPE == "Pinecone":
        query_type = "vector"

        data_source = {
            "type": "pinecone",
            "parameters": {
                "environment": PINECONE_ENVIRONMENT,
                "authentication": {
                    "type": "api_key",
                    "key": PINECONE_API_KEY
                },
                "index_name": PINECONE_INDEX_NAME,
                "fields_mapping": {
                    "content_fields": parse_multi_columns(PINECONE_CONTENT_COLUMNS) if PINECONE_CONTENT_COLUMNS else [],
                    "title_field": PINECONE_TITLE_COLUMN if PINECONE_TITLE_COLUMN else None,
                    "url_field": PINECONE_URL_COLUMN if PINECONE_URL_COLUMN else None,
                    "filepath_field": PINECONE_FILENAME_COLUMN if PINECONE_FILENAME_COLUMN else None,
                    "vector_fields": parse_multi_columns(PINECONE_VECTOR_COLUMNS) if PINECONE_VECTOR_COLUMNS else []
                },
                "in_scope": True if PINECONE_ENABLE_IN_DOMAIN.lower() == "true" else False,
                "top_n_documents": int(PINECONE_TOP_K) if PINECONE_TOP_K else int(SEARCH_TOP_K),
                "strictness": int(PINECONE_STRICTNESS) if PINECONE_STRICTNESS else int(SEARCH_STRICTNESS),
                "query_type": query_type,
                "role_information": AZURE_OPENAI_SYSTEM_MESSAGE,
            }
        }
    else:
        raise Exception(f"DATASOURCE_TYPE is not configured or unknown: {DATASOURCE_TYPE}")

    if "vector" in query_type.lower() and DATASOURCE_TYPE != "AzureMLIndex":
        embeddingDependency = {}
        if AZURE_OPENAI_EMBEDDING_NAME:
            embeddingDependency = {
                "type": "deployment_name",
                "deployment_name": AZURE_OPENAI_EMBEDDING_NAME
            }
        elif AZURE_OPENAI_EMBEDDING_ENDPOINT and AZURE_OPENAI_EMBEDDING_KEY:
            embeddingDependency = {
                "type": "endpoint",
                "endpoint": AZURE_OPENAI_EMBEDDING_ENDPOINT,
                "authentication": {
                    "type": "api_key",
                    "key": AZURE_OPENAI_EMBEDDING_KEY
                }
            }
        elif DATASOURCE_TYPE == "Elasticsearch" and ELASTICSEARCH_EMBEDDING_MODEL_ID:
            embeddingDependency = {
                "type": "model_id",
                "model_id": ELASTICSEARCH_EMBEDDING_MODEL_ID
            }
        else:
            raise Exception(f"Vector query type ({query_type}) is selected for data source type {DATASOURCE_TYPE} but no embedding dependency is configured")
        data_source["parameters"]["embedding_dependency"] = embeddingDependency

    return data_source

def prepare_model_args(request_body):

    def cleanMessage(message):
        #remove citation tags
        cleaned_message = re.sub(r'\[doc[1-5]\]', '', message)
        return cleaned_message
    
    logging.debug("PREPARING MODEL ARGS")
    try:
        authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    except Exception as e:
        logging.exception("Exception in get_authenticated_user_details")
        raise e
    user_id = authenticated_user['user_principal_id']
    request_messages = request_body.get("messages", [])
    request_filenames = request_body.get("filenames", [])
    messages = []
    totalTokens = 0
    encoding = tiktoken.get_encoding("cl100k_base")

    for index, message in enumerate(reversed(request_messages)):
        if message and message["role"] != "tool":
            totalTokens += len(encoding.encode(message["content"]))
            if totalTokens>6000:
                print('Message list too long, truncating to 6000 tokens which is ', index, ' messages.')
                break
            messages.insert(0,{
                "role": message["role"] ,
                "content": cleanMessage(message["content"])
            })
                
    model_args = {
        "messages": messages,
        "temperature": float(AZURE_OPENAI_TEMPERATURE),
        "max_tokens": int(AZURE_OPENAI_MAX_TOKENS),
        "top_p": float(AZURE_OPENAI_TOP_P),
        "stop": parse_multi_columns(AZURE_OPENAI_STOP_SEQUENCE) if AZURE_OPENAI_STOP_SEQUENCE else None,
        "stream": SHOULD_STREAM,
        "model": AZURE_OPENAI_MODEL,
    }

    if len(request_filenames) == 0:
        print('no files')
        messages.insert(0,
                {
                    "role": "system",
                    "content": AZURE_OPENAI_SYSTEM_MESSAGE
                }
        )
    elif len(request_filenames) > 0:
        print('Request filenames: ', request_filenames)
        editted_messages = messages.copy()
        editted_messages[-1]["content"] = "You are answering questions about the following documents: " + ", ".join(request_filenames) + ". " + editted_messages[-1]["content"]
        model_args["messages"] = editted_messages
        model_args["extra_body"] = {
            "data_sources": [get_configured_data_source(user_id, request_filenames)]
        }

    model_args_clean = copy.deepcopy(model_args)
    if model_args_clean.get("extra_body"):
        secret_params = ["key", "connection_string", "embedding_key", "encoded_api_key", "api_key"]
        for secret_param in secret_params:
            if model_args_clean["extra_body"]["data_sources"][0]["parameters"].get(secret_param):
                model_args_clean["extra_body"]["data_sources"][0]["parameters"][secret_param] = "*****"
        authentication = model_args_clean["extra_body"]["data_sources"][0]["parameters"].get("authentication", {})
        for field in authentication:
            if field in secret_params:
                model_args_clean["extra_body"]["data_sources"][0]["parameters"]["authentication"][field] = "*****"
        embeddingDependency = model_args_clean["extra_body"]["data_sources"][0]["parameters"].get("embedding_dependency", {})
        if "authentication" in embeddingDependency:
            for field in embeddingDependency["authentication"]:
                if field in secret_params:
                    model_args_clean["extra_body"]["data_sources"][0]["parameters"]["embedding_dependency"]["authentication"][field] = "*****"
        
    logging.debug(f"REQUEST BODY: {json.dumps(model_args_clean, indent=4)}")
    return model_args


async def generate_title(conversation_messages):
    ## make sure the messages are sorted by _ts descending
    title_prompt = 'Summarize the conversation so far into a 4-word or less title. Do not use any quotation marks or punctuation. Respond with a json object in the format {{"title": string}}. Do not include any other commentary or description.'

    messages = [{'role': msg['role'], 'content': msg['content']} for msg in conversation_messages]
    messages.append({'role': 'user', 'content': title_prompt})

    try:
        azure_openai_client = init_openai_client(use_data=False)
        response = await azure_openai_client.chat.completions.create(
            model=AZURE_OPENAI_MODEL,
            messages=messages,
            temperature=1,
            max_tokens=64
        )
        
        title = json.loads(response.choices[0].message.content)['title']
        return title
    except Exception as e:
        return messages[-2]['content']


def get_doc_from_azure_blob_storage(blob_name: str, storage_account_container: str) -> List[Document]:
    """Load a file (PDF or TXT) from Azure Storage Blob."""
    print(f'Downloading file from Azure Blob Storage: {blob_name}')
    storage_account_url = f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/"
    try:
        blob_client = BlobClient(
            account_url=storage_account_url,
            container_name=storage_account_container,
            blob_name=blob_name,
            credential=AZURE_STORAGE_KEY
        )
        
        # Truncate the original blob name if needed, keeping the extension
        name, ext = os.path.splitext(blob_name)
        if len(name) > 50:  # arbitrary reasonable length
            name = name[:47] + "..."  # 47 + 3 dots = 50
        safe_blob_name = name + ext

        rand_int = random.randint(0, 1000000)
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f"{storage_account_container[:10]}-{rand_int}-{safe_blob_name}")
        
        with open(file_path, "wb") as file:
            blob_data = blob_client.download_blob()
            blob_data.readinto(file)
        
        try:
            if blob_name.lower().endswith('.pdf'):
                loader = PyPDFLoader(file_path)
            elif blob_name.lower().endswith('.txt'):
                loader = TextLoader(file_path)
            elif blob_name.lower().endswith('.docx'):
                loader = Docx2txtLoader(file_path)
            else:
                raise ValueError(f"Unsupported file type: {blob_name}")
            
            docs = loader.load()
            return docs
        finally:
            # Clean up the temporary file
            if os.path.exists(file_path):
                os.remove(file_path)
                
    except Exception as ex:
        print(f'ERROR DOWNLOADING FILE FROM AZURE BLOB STORAGE: {ex}')
        return 'error: ' + str(ex)