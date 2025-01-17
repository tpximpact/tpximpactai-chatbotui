import asyncio
import json
from typing import Dict, List

from quart import jsonify, request


from backend.auth.auth_utils import get_authenticated_user_details

import tiktoken
from langchain.text_splitter import RecursiveCharacterTextSplitter


from azure.storage.blob import BlobServiceClient
from azure.search.documents.indexes.models import *

from langchain.schema import Document

from backend.setup import AZURE_OPENAI_MODEL, AZURE_OPENAI_SYSTEM_MESSAGE, AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, get_doc_from_azure_blob_storage, init_container_client, init_openai_client, init_search_client, init_vector_store

def chunkString(text, chunk_size,overlap):
    SENTENCE_ENDINGS = [".", "!", "?"]
    WORDS_BREAKS = list(reversed([",", ";", ":", " ", "(", ")", "[", "]", "{", "}", "\t", "\n"]))


    splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        separators=SENTENCE_ENDINGS + WORDS_BREAKS,
        chunk_size=chunk_size, chunk_overlap=overlap)
    chunked_content_list = splitter.split_text(text)

    return chunked_content_list


async def collect_documents_from_index(filenames, user_id):
    allDocsString = ""
    for filename in filenames:
        print(f"Collecting document: {filename} which is document {filenames.index(filename)+1} of {len(filenames)}")
        allDocsString += f" START OF DOCUMENT {filenames.index(filename)+1}, {filename}:"
        try:
            search_client = init_search_client()
            search_results = search_client.search(
                search_text="*",  # Use '*' to match all documents
                filter=f"user_id eq '{user_id}' and filename eq '{filename}'",
                search_fields=["user_id", "filename"],
                select=["id", "content"],  # Adjust fields based on your index schema
                order_by=["id"]  # Ensure the chunks are ordered by 'id'
            )
            if not search_results:
                raise Exception("No results found in search index")
            docString = ""
            chunks = [doc['content'] for doc in search_results]
            docString = merge_chunks(chunks)

            allDocsString += docString
        except Exception as e:
            print(f"Error collecting chunks from search index: {e}")
            raise e
    return allDocsString

def merge_chunks(chunks, overlap=200):
    window_size = 10
    merged_tokens = []
    previous_tokens = []
    encoding = tiktoken.get_encoding("cl100k_base")
    for chunk in chunks:
        current_tokens = encoding.encode(chunk)

        if previous_tokens:
            # Find the overlap using a sliding window
            overlap_tokens = previous_tokens[-overlap:]
            overlap_index = 0
            best_overlap_length = 0

            for i in range(len(overlap_tokens) - window_size + 1):
                window = overlap_tokens[i:i + window_size]
                for j in range(len(current_tokens) - window_size + 1):
                    if window == current_tokens[j:j + window_size]:
                        overlap_length = len(overlap_tokens) - i
                        if overlap_length > best_overlap_length:
                            best_overlap_length = overlap_length
                            overlap_index = i
                        break

            current_tokens = current_tokens[best_overlap_length:]

        merged_tokens.extend(current_tokens)
        previous_tokens = current_tokens

    return encoding.decode(merged_tokens)


async def summarize_chunk(chunk: str, max_tokens: int, prompt = 'Produce a detailed summary of the following including all key concepts and takeaways, if it is a guide or a help piece make sure you include a summary of the main actionable steps:') -> str:
    azure_openai_client = init_openai_client(use_data=False)
    response = await azure_openai_client.chat.completions.create(
        model=AZURE_OPENAI_MODEL,
        messages=[{'role': 'system', 'content': AZURE_OPENAI_SYSTEM_MESSAGE},
                  {'role': 'user', 'content': f'{prompt} {chunk}'}],
        temperature=1,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content


async def handle_document_refinement(websocket, data):
    abort_flag = False

    async def listen_for_abort():
        nonlocal abort_flag
        while not abort_flag:
            data = await websocket.receive()
            data = json.loads(data)
            if data.get('command') == 'abort':
                abort_flag = True

    asyncio.create_task(listen_for_abort())

    filenames = data['filenames']
    prompt = data['prompt']
    container_name = data['container']
    
    if not prompt == '':
        prompt = 'In your answer adhere to the following instruction: ' + prompt + '. Here is the document: '
    
    try:
        document = await collect_documents_from_index(filenames, container_name)
    except Exception as e:
        print(f"Error collecting documents: {e}")
        return

    chunks = chunkString(document, 3500, 100)
    combined_summaries = ""
    for chunk in chunks:
        if abort_flag:
            return
        index = chunks.index(chunk)
        if index == len(chunks) - 1:
            break
        await websocket.send(f"{chunks.index(chunk)+1}/{len(chunks)}")
        combined_summaries = await summarize_chunk(combined_summaries + chunk, 4000)
    
    final_prompt = f'Tell me in as much detail as possible what the following document(s) is about. Make sure your answer includes the concepts, themes, priciples and methods that are covered. {prompt}'
    await websocket.send(f"done:{final_prompt} {combined_summaries} {chunks[len(chunks)-1]}")


async def documentsummary():
    encoding = tiktoken.get_encoding("cl100k_base")
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    storage_container_name = authenticated_user['user_principal_id']
    data = await request.json
    filenames = data.get("filenames", [])
    prompt = data.get("prompt", "")

    if len(filenames) == 0:
        return jsonify({"error": "Filenames not found"}), 400
    # await collect_documents_from_index(filenames, storage_container_name)
    docString = await collect_documents_from_index(filenames, storage_container_name)
    num_tokens = len(encoding.encode(docString))
    if not prompt == '':
        prompt = 'In your answer adhere to the following instruction: ' + prompt + '. Here is the document: '
    try:
        if num_tokens > 4000:
            chunks = chunkString(docString, 4000, 100)
            chunk_summaries = await asyncio.gather(*[summarize_chunk(chunk, round(4000/len(chunks))) for chunk in chunks])
            combined_summaries = " ".join(chunk_summaries)
            final_prompt = f'I have a document that I have broken into chunks, the folliwng is the summary of each chunk. Tell me in as much detail as possible what the document is about. Make sure your answer includes the concepts, themes, priciples and methods that are covered. {prompt}'
        else:
            final_prompt = f'Tell me in as much detail as possible what the following document(s) is about. Make sure your answer includes the concepts, themes, priciples and methods that are covered. {prompt}'
            combined_summaries = docString
        return jsonify({"response": f'{final_prompt} {combined_summaries}'}), 200
    except Exception as e:
        print(f"Error reducing document: {e}")
        return jsonify({"error": f"Error reading document: {e}"}), 500


# def convert_doc(documents, blob_name, url, container_name, encoding):

#     print('Converting documents, there are ', len(documents), ' documents in this collection.')
#     docs = []
#     full_text = []
#     num_tokens = 0
#     doc_url_list = ['doc_url', 'user_id']
    
#     # for every page in the document
#     for document in documents:
#         # count the number of tokens in the document as this is the only time we're looking at the raw document text all in one place
#         num_tokens += len(encoding.encode(document.text))

#         document.text = document.text.replace("\n",".  ").replace('..', '.')
#         document.text = re.sub(r"\s+", " ", document.text)
#         # extract and merge the text from individual pages
#         full_text.append(document.text)

#     # create a new Document with metadata fields and all text in one Document
#     docs.append(Document(

#         # make sure ID of the document is the pdf name without extension
#         id_ = re.sub(r'[^\w&=.-]', '_', blob_name).strip('_').replace(' ', '_').replace('.pdf','').replace('.PDF',''),

#         # join the text of the PDF into a single string
#         text = ' '.join(full_text),

#         # add metadata fields
#         metadata = {
#             #'title': blob_name.replace('.pdf','').replace('.PDF',''),
#             'user_id': container_name,
#             'doc_url': url,
#             'filename': blob_name,
#         },
#         # don't use the fields added as metadtata in the embedding/llm processes
#         excluded_embed_metadata_keys = doc_url_list,
#         excluded_llm_metadata_keys = doc_url_list
#     ))
    
#     return docs, num_tokens

# async def handle_document_processing(websocket, data):
#     encoding = tiktoken.get_encoding("cl100k_base")
#     abort_flag = False

#     async def listen_for_abort():
#         nonlocal abort_flag
#         while not abort_flag:
#             data = await websocket.receive()
#             data = json.loads(data)
#             if data.get('command') == 'abort':
#                 print("ABORT RCVD")
#                 abort_flag = True

#     asyncio.create_task(listen_for_abort())

#     list_of_lists = data['documents']
#     container_name = data['container']
#     document_tuples = [tuple(item) for item in list_of_lists]
    
#     chunk_size = 1000
#     chunk_overlap = 100

#     # Initialize clients and models
#     search_client = init_search_client()
#     container_client = init_container_client(container_name)
#     llm = AzureOpenAI(
#         model=AZURE_OPENAI_MODEL_NAME,
#         deployment_name=AZURE_OPENAI_MODEL,
#         api_key=AZURE_OPENAI_KEY,
#         azure_endpoint=AZURE_OPENAI_ENDPOINT,
#         api_version=AZURE_OPENAI_PREVIEW_API_VERSION,
#     )
#     embed_model = AzureOpenAIEmbedding(
#         model=AZURE_OPENAI_EMBEDDING_MODEL_NAME,
#         deployment_name=AZURE_OPENAI_EMBEDDING_NAME,
#         api_key=AZURE_OPENAI_KEY,
#         azure_endpoint=AZURE_OPENAI_ENDPOINT,
#         api_version=AZURE_OPENAI_PREVIEW_API_VERSION,
#     )
#     Settings.llm = llm
#     Settings.embed_model = embed_model

#     final_nodes = []

#     # Process each document
#     for doc in document_tuples:
#         if abort_flag:
#             return
#         num_tokens = 0
#         blob_name, url = doc
#         blob_client = container_client.get_blob_client(blob_name)
        
#         # Handle document loading
#         if blob_name.endswith('.docx'):
#             print(f"Downloading document in handle_document_processing: {blob_name}")
#             logging.info(f"Downloading document in handle_document_processing: {blob_name}")
            
#             try:
#                 download_stream = blob_client.download_blob()
#                 with io.BytesIO() as output_stream:
#                     download_stream.readinto(output_stream)
#                     doc = docx.Document(output_stream)
#                     documents = []
#                     await websocket.send('2')
#                     for para in doc.paragraphs:
#                         num_tokens += len(encoding.encode(para.text))
#                         documents.append(para)
#             except Exception as e:
#                 print(f"Error downloading document in handle_document_processing: {e}")
#                 await websocket.send(f"error: {e}")
#                 return
#         else:
#             print(f'Processing {blob_name} with url {url}.')
#             # create the loader

#             loader = AzStorageBlobReader(
#                 account_url = f'https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net',
#                 container_name = container_name,
#                 blob = blob_name,
#                 credential = AZURE_STORAGE_KEY # replace this with DefaultAzureCredential() once MI is set up
#             )
#             # load in document
#             await websocket.send('2')
#             try:
#                 documents = loader.load_data()
#                 for document in documents:
#                     num_tokens += len(encoding.encode(document.text))
#             except Exception as e:
#                 print(f"Error loading document: {e}")
#                 await websocket.send(f"error")
#                 return
        
#         await websocket.send('3')
#         if abort_flag:
#             return


#         # convert documents to the correct format for us
#         docs, num_tokens = convert_doc(documents, blob_name, url, container_name, encoding)
#         if abort_flag:
#             return
        
#         # set the number of tokens as metadata for the blob
#         blob_client.set_blob_metadata(metadata={'num_tokens': str(num_tokens)})

#         # define a node parser (specify chunk size and overalap)
#         node_parser = SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

#         # split the documents into nodes (aka chunks)
#         nodes = node_parser.get_nodes_from_documents(docs, show_progress=False)

#         # change the node ID to document name + chunk/node number
#         chunk_num = 1


#         for node in nodes:
#             node.id_ = re.sub(r'[^a-zA-Z0-9_]', '_', blob_name).strip('_').replace(' ', '_').replace('_pdf','').replace('_PDF','').replace('___', '_') + str(chunk_num)
#             chunk_num = chunk_num + 1

#         # generate embeddings for each node
#         progress = 4
#         if len(nodes) > 50:
#             interval = math.floor(len(nodes)/5)
#         else: 
#             interval = len(nodes)
#             progress = 9
#         for index, node in enumerate(nodes):
#             if index % interval == 0:
#                 if abort_flag:
#                     return
#                 await websocket.send(f"{progress}")
#                 progress = progress + 1
#             node_embedding = embed_model.get_text_embedding(
#                 node.get_content(metadata_mode="all")
#             )
#             node.embedding = node_embedding
#         if abort_flag:
#             return

#         # add all the nodes to a final list that will be added to the search index
#         final_nodes.append(nodes)

#     # flatten the list of nodes
#     flat_nodes_list = [item for node in final_nodes for item in node]

#     # define additional fields to be added to the search index 
#     # (needs to match the fields added in CreateSearchIndex)
#     metadata_fields = {
#         'user_id': 'user_id',
#         'doc_url': 'doc_url',
#         'filename': 'filename'
#     }


#     # define the vector store we will be connecting to 
#     # (needs to match the fields added in CreateSearchIndex)
#     vector_store = AzureAISearchVectorStore(
#         search_or_index_client=search_client,
#         filterable_metadata_field_keys=metadata_fields,
#         index_management=IndexManagement.VALIDATE_INDEX,
#         id_field_key="id",
#         chunk_field_key="content",
#         embedding_field_key="content_vector",
#         embedding_dimensionality=1536,
#         metadata_string_field_key="llamaindex_metadata",
#         doc_id_field_key="llamaindex_doc_id"
#     )

#     # set the storage context
#     storage_context = StorageContext.from_defaults(vector_store=vector_store)

    
#     # load the index
#     index = VectorStoreIndex.from_documents(
#         [],
#         storage_context=storage_context,
#     )

#     if abort_flag:
#         return

#     # add the nodes to the vector store/search index
#     index.insert_nodes(flat_nodes_list)

#     # get the ID-s of the documents added to the search index
#     node_ids = ', '.join([node.id_ for node in flat_nodes_list])

#     print(f"Documents added to the search index. Document IDs: {node_ids}")
#     if abort_flag:
#         return
#     await websocket.send(f"done: Document IDs added to the search index: {node_ids}")

async def handle_new_document(websocket, data):
    encoding = tiktoken.get_encoding("cl100k_base")
    abort_flag = False

    async def listen_for_abort():
        nonlocal abort_flag
        while not abort_flag:
            data = await websocket.receive()
            data = json.loads(data)
            if data.get('command') == 'abort':
                abort_flag = True

    asyncio.create_task(listen_for_abort())

    list_of_lists = data['documents']
    container_name = data['container']
    document_tuples = [tuple(item) for item in list_of_lists]

    all_texts = []
    all_metadatas = []
    for doc in document_tuples:
        if abort_flag:
            return
        num_tokens = 0
        blob_name, url = doc

        documents = get_doc_from_azure_blob_storage(blob_name, container_name)
        await websocket.send('3')
        if abort_flag:
            return

        for document in documents:
            num_tokens += len(encoding.encode(document.page_content))

        container_client = init_container_client(container_name)
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.set_blob_metadata(metadata={'num_tokens': str(num_tokens)})
        await websocket.send('4')
        if abort_flag:
            return
        joined_docs = join_and_split_docs(documents)
        texts, metadatas = add_metadata_to_docs(joined_docs, container_name, blob_name, url)
        await websocket.send('5')
        if abort_flag:
            return
        all_texts.extend(texts)
        all_metadatas.extend(metadatas)
    vector_store = init_vector_store()
    await websocket.send('6')
    if abort_flag:
        return
    print(f"Adding {len(all_texts)} documents to the search index")
    print(all_metadatas)
    vector_store.add_texts(all_texts, all_metadatas)
    await websocket.send('7')
    if abort_flag:
        return
    print(f"Documents added to the search index.")
    if abort_flag:
        return
    await websocket.send(f"done: Documents added to the search index")



async def upload_documents():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    storage_container_name = authenticated_user['user_principal_id']
    uploadedFiles = []
    try:
        files = await request.files
        if 'file' not in files:
            print("No files part in the request")
            return jsonify({"error": "No files part in the request"}), 400
        file_storage_list = files.getlist('file')

        if not file_storage_list:
            print("No files selected for uploading")
            return jsonify({"error": "No files selected for uploading"}), 400
        
        for doc in file_storage_list:

            file_name = doc.filename
            storage_account_url = f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/"

            blob_service_client = BlobServiceClient(
                account_url=storage_account_url, 
                credential=AZURE_STORAGE_KEY
            )
            print('Got blob service client')
            container_client = blob_service_client.get_container_client(storage_container_name)
            print('Got container client')
            try:
                container_client.create_container()
                print(f"Container '{storage_container_name}' created.")
            except Exception as e:
                if "ContainerAlreadyExists" in str(e):
                    print(f"Container '{storage_container_name}' already exists.")
                else:
                    print(f"Error creating container: {e}")
                    raise e
            print('Container created')
            blob_client = blob_service_client.get_blob_client(
                container=storage_container_name,
                blob=file_name
            )
            print('Getting blob client')
            blob_client.upload_blob(doc.stream, overwrite=True)
            print('Uploading blob')
            uploadedFiles.append((file_name, blob_client.url))
            print(f"Successfully uploaded {file_name} at location {blob_client.url}.")
        return jsonify({"Documents": uploadedFiles}, 200)
    except Exception as ex:
        print(f"Uploading Documents failed. Exception: {ex}")
        return jsonify({"error": f"Uploading Documents failed. Exception: {ex}"}, 500)


async def get_documents():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user['user_principal_id']
    container_client = init_container_client(user_id)
    try:
        blob_list = container_client.list_blob_names()
        filenames_with_counts = {} 
        for blob in blob_list:
            blob_client = container_client.get_blob_client(blob)
            filenames_with_counts[blob] = blob_client.get_blob_properties().metadata['num_tokens']
            print('Blob name: ' + blob + ' Number of tokens: ' + filenames_with_counts[blob])
        print(f"Successfully retrieved documents: {filenames_with_counts}")

        ### If storage is not being used the data can be retrieved from the search index ###

        # search_client = init_search_client()
        # search_results = search_client.search(
        #     search_text=user_id,
        #     search_fields=["user_id"],
        #     facets=["filename"],  # Using facets to get unique filenames
        #     top=0,  # We don't need the actual documents, just the facets
        #     include_total_count=True
        # )
        # facet_results = search_results.get_facets()
        # print(facet_results)
        # if 'filename' in facet_results:
        #     filenames_with_counts = {facet['value']: str(facet['count']) for facet in facet_results['filename'][:10]}
        # else:
        #     filenames_with_counts = {}
        # print(f"successfully retrieved documents from search index:{filenames_with_counts}")


        return jsonify(filenames_with_counts), 200
    except Exception as ex:
        print(f"Failed to get documents. Exception: {ex}")
        return jsonify({"error": f"Failed to get documents. Exception: {ex}"}), 500


async def delete_documents():
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    container_client = init_container_client(authenticated_user['user_principal_id'])
    request_json = await request.get_json()
    requested_blobs = request_json.get('filenames', [])
    try:
        search_client = init_search_client()
        blob_list = container_client.list_blob_names()
        for blob in requested_blobs:
            print(f"Deleting {blob}")

            try:
                container_client.delete_blob(blob)
            except Exception as ex:
                print(f"Failed to delete {blob} from storage. Exception: {ex}")
            try:
                results = search_client.search(search_text=blob, search_fields=["filename"])
                for doc in results:
                    print(doc['id'])
                    if doc['filename'] == blob:
                        search_client.delete_documents(documents=[{"id": doc['id']}])
                        print(f"Deleted {doc['id']} from search index")
                    else:
                       Exception('Document not found in search index')
            except Exception as ex:
                print(f"Failed to delete {blob} from search index. Exception: {ex}")
        return jsonify({"success": "All documents deleted"}), 200
    except Exception as ex:
        return jsonify({"error": f"Failed to delete documents. Exception: {ex}"}), 500


def add_metadata_to_docs(docs: List[Document],user_id: str, file_name: str, doc_url: str) -> List[Dict]:
    texts = []
    metadatas = []

    for index, doc in enumerate(docs):
        # Extract the content
        content = doc.page_content if hasattr(doc, 'page_content') else doc.content
        texts.append(content)

        # Create metadata dictionary
        metadata = {
            "user_id": user_id,
            "filename": file_name,
            "doc_url": doc_url,
            "chunk_number": str(index)
        }
        metadatas.append(metadata)

    return texts, metadatas


def join_and_split_docs(docs):
    """
    Joins the pages into a single document and then splits it into chunks
    """
    joint_doc = Document(page_content="")
    for doc in docs:
        joint_doc.page_content += doc.page_content if hasattr(doc, 'page_content') else doc.content

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=100)
    split_docs = text_splitter.split_documents([joint_doc])
    return split_docs


def ingest_all_docs_from_storage():
    all_containers = BlobServiceClient(account_url=AZURE_STORAGE_ACCOUNT, credential=AZURE_STORAGE_KEY).list_containers()
    for container in all_containers:
        container_client = BlobServiceClient(account_url=AZURE_STORAGE_ACCOUNT, credential=AZURE_STORAGE_KEY).get_container_client(container.name)
        blob_list = container_client.list_blob_names()
        for blob in blob_list:
            docs = get_doc_from_azure_blob_storage(blob, container.name)
            joined_docs = join_and_split_docs(docs)
            texts, metadatas = add_metadata_to_docs(joined_docs, container.name, blob, blob)
            init_vector_store().add_texts(texts, metadatas)
            print(f"Ingested {blob} from {container.name}")
    print(f"Ingested all documents from storage")