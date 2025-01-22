import React, { useEffect, useMemo, useState } from 'react'
import {DropEvent, FileRejection, useDropzone} from 'react-dropzone'
import COLOURS from '../../constants/COLOURS'
import Loading from '../Loading'
import { deleteDocuments, getDocuments, getUserIdentity, uploadFiles } from '../../api'
import FileIcon from './FileIcon'
import { CommandBarButton, Dialog, DialogType } from '@fluentui/react'
import styles from './DocumentUpload.module.css'
import { useBoolean } from '@fluentui/react-hooks'

const baseStyle = {
    borderColor: 'black',
    borderWidth: 1,
    margin: '30px 1px',
    borderRadius: '50px',
    outline: 'none',
    transition: 'border .24s ease-in-out',
    cursor: 'pointer',
    height:'250px',
    width:'90%',
    overflow: 'auto',
  };
  
  const focusedStyle = {
    borderColor: 'black'
  };
  
  const acceptStyle = {
    borderColor: 'green'
  };
  
  const rejectStyle = {
    borderColor: '#ff1744'
  };

  
  interface DocumentUploadProps {
    handleAskQuestions: (filenames: string[]) => void
    handleSummarise: (filenames: string[]) => void
    setUploadWS: React.Dispatch<React.SetStateAction<WebSocket | null>>
    setUploading: React.Dispatch<React.SetStateAction<string[]>>
    setProgress: React.Dispatch<React.SetStateAction<number>>
    setDocData: React.Dispatch<React.SetStateAction<{[key: string]: string}>>
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
    handleAskQuestions, 
    handleSummarise, 
    setUploadWS,
    setProgress,
    setUploading,
    setDocData,
}) => {
    const [loading, setLoading] = useState(true)
    const [documents, setDocuments] = useState<string[]>([])
    const [selectedFiles, setSelectedFiles] = useState<string[]>([])
    const [hideErrorDialog, { toggle: toggleErrorDialog }] = useBoolean(true);
    const [errorMsg, setErrorMsg] = useState<{title: string, subtitle: string}>()

    const errorDialogContentProps = {
        type: DialogType.close,
        title: errorMsg?.title,
        closeButtonAriaLabel: 'Close',
        subText: errorMsg?.subtitle,
        styles: { subText: { fontFamily:'DMSans-Regular' }, title: { fontFamily:'PlayfairDisplay-Regular' }, inner: { fontFamily:'DMSans-Regular' }, content: { fontFamily:'DMSans-Regular'}},

    };

    const modalProps = {
        titleAriaId: 'labelId',
        subtitleAriaId: 'subTextId',
        isBlocking: true,
        styles: { main: { maxWidth: 450, borderRadius:'20px' } },
    }

    useEffect(() => {
        getDocuments().then((res) => {
            if (res) {
                if (res.status === 200) {
                    res.json().then((data) => {
                        setDocuments(Object.keys(data))
                        setDocData(data)
                        setLoading(false)
                    })
                }
                else {
                    setLoading(false)
                }}})}, [])
                
    const initiateWebSocket = async (processing: string[]) => {
        const fetchData = async () => {
            try {
                const response = await getUserIdentity();
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                return data; 
            } catch (error) {
                console.error('Error fetching user identity:', error);
            }
        };

        const user_id = await fetchData();
        if (!user_id) {
            return;
        }
        const ws = new WebSocket("/process_documents");
        setUploadWS(ws);

        ws.onmessage = (event) => {
            setProgress(event.data);
            if (event.data.startsWith('error:')) {
                console.log('Error processing document:', event.data);
                ws.close();
                deleteDocuments(processing.map((doc) => doc[0]));
                setErrorMsg({title: 'Error processing document', subtitle: 'Please refresh the page and try again.'});
                toggleErrorDialog();
            } else if (event.data.startsWith('done:')) {
                ws.close();
                const fileNames = processing.map((doc) => doc[0]);
                setDocuments((prevDocs) => [...prevDocs, ...fileNames]);
                setUploading([]);
                setProgress(0);
            } else {
                setProgress(Number(event.data)/7)
            }
            };
        ws.onopen = () => {
            const data = {
                documents: processing,
                container: user_id,
            };
            const jsonData = JSON.stringify(data);
            ws.send(jsonData);
        };
    };


    const handleSelectedButton = async () => {
        if (selectedFiles.length  < documents.length) {
            setSelectedFiles(documents);
        }
        else {
            setSelectedFiles([]);
        }
    }
    const onDrop = async (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
        // Upload ffiles then initiate websocket to add the files to the search index and recieve progress updates
        
        setSelectedFiles([]);
        const fileNames = acceptedFiles.map(file => file.name);
        if (documents.length + fileNames.length > 10) {
            setErrorMsg({title: 'Too many files', subtitle: 'You can only upload a maximum of 10 documents'});
            toggleErrorDialog();
            return;
        }
        try {
            const fileList = new DataTransfer();
            for (const file of acceptedFiles) {
                if (documents.includes(file.name)) {
                    setErrorMsg({title: 'Duplicate file', subtitle: `You already have a document with the name '${file.name}'. Please rename the document and try again.`});
                    toggleErrorDialog();
                    continue;
                }
                fileList.items.add(file);
            }
            console.log("about to upload files")
            setUploading(fileNames);
            const res = await uploadFiles(fileList.files);
            if (res.status === 200) {
                const resJson = await res.json();
                initiateWebSocket(resJson[0]['Documents']);                
                setProgress(1/9)
            } else {
                throw new Error('Error uploading files');
            }
        } catch (error) {
            console.error('Error uploading files:', error);
            setErrorMsg({title: 'Error uploading files', subtitle: "Try taking any special characters out of your filename. Please refresh the page and try again later. (Only .pdf, .docx, .txt files are supported)"});
            toggleErrorDialog();
            deleteDocuments(fileNames);
        } finally {
        }
    };

    
    const handleDocSelect = (doc: string, e:any) => {
        e.stopPropagation();
        if (selectedFiles.includes(doc)) {
            setSelectedFiles(selectedFiles.filter((selectedFiles) => selectedFiles !== doc));
        } else {
            setSelectedFiles([...selectedFiles, doc]);
        }
    }

    const handleDelete = async () => {
        setLoading(true)
        deleteDocuments(selectedFiles).then((res) => {
            if (res){
                if (res.status === 200) {
                    setDocuments(documents.filter((doc) => !selectedFiles.includes(doc)))
                    setSelectedFiles([])
                    setLoading(false)
                } else {
                    setErrorMsg({title: 'Error deleting documents', subtitle: 'Please refresh the page and try again later.'});
                    toggleErrorDialog();
                    setLoading(false)
                }
            }})
    }

    const onAskQuestions = () => {
        handleAskQuestions(selectedFiles)
        setTimeout(() => {
            setSelectedFiles([])
        }, 1000)
    }

    const onSummarise = () => {
        handleSummarise(selectedFiles)
        setTimeout(() => {
            setSelectedFiles([])
        }, 1000)
    }

    const handleErrorDialogClose = () => {
        toggleErrorDialog()
        setTimeout(() => {
            setErrorMsg(undefined)
        }, 500);
    }


    const {    
        isFocused,
        isDragAccept,
        isDragReject,
        acceptedFiles,
        getRootProps,
        getInputProps,
        inputRef,
        isDragActive,
    } = useDropzone({
        onDrop,
        onDropRejected: (fileRejections) => {
            const errorMessage = fileRejections[0]?.errors[0]?.message || 'Invalid file type';
            console.log("errorMessage", errorMessage)
            setErrorMsg({
                title: 'Invalid file type', 
                subtitle: 'Only .pdf, .docx, and .txt files are supported.'
            });
            toggleErrorDialog();
        },
        accept: {
            'text/plain': ['.txt'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/pdf': ['.pdf'],},
        maxFiles: 10,
        multiple: true,
        noDragEventsBubbling: true,
        
    });
          
    console.log("documents.length", documents.length)
    const style = useMemo(() => ({
        // borderStyle: documents.length > 0 ? 'none' : 'dashed',
        backgroundColor: documents.length > 0 ? '#F9F9F9' : 'white',
        ...baseStyle,
        ...(isFocused ? focusedStyle : {}),
        ...(isDragAccept ? acceptStyle : {}),
        ...(isDragReject ? rejectStyle : {})
      }), [
        isFocused,
        isDragAccept,
        isDragReject,
        documents.length
      ]);
      const isButtonDisabled = selectedFiles.length === 0;
      const buttonColor = isButtonDisabled ? '#BDBDBD' : COLOURS.black;


    return (
        <div className={styles.container}>
            <Dialog
                hidden={hideErrorDialog}
                onDismiss={handleErrorDialogClose}
                dialogContentProps={errorDialogContentProps}
                modalProps={modalProps}
            >
            </Dialog>

            { 
            loading ? 
            <div className={styles.loadingContainer}>

                <div className={styles.loadingBox}>
                    <Loading size = {50} color='black'/> 
                </div>
            </div>
            :
            <div className={styles.fileUploadContainer}>
                    <div {...getRootProps({style})}>
                        <input {...getInputProps()} />

                    {isDragActive ?
                        <div className={styles.dragZoneContainer}>
                            <p className={styles.dragZoneText}>
                                Drop the file(s) here...
                            </p> 
                        </div>
                    :
                    documents.length > 0 ?
                        <div className={styles.documentsContainer}>
                            {documents.map((doc, index) => {
                                return (
                                    <div key={index} className={styles.document} onClick={(e) => handleDocSelect(doc, e)}>
                                        <FileIcon title={doc} key={index} selected={selectedFiles.includes(doc)}/>
                                    </div>
                                )
                            })}
                        </div>
                    :
                        <div className={styles.dropzoneEmpty}>

                            <p className={styles.dropzoneText}>Drag and drop the document(s) you want to summarise here.<br />
                                    (Accepted formats are .pdf, .docx, .txt)
                                    <br />
                                    <br />
                                    or
                                    <br />
                                    <br />
                                    <span className={styles.browseLink}>Browse</span>
                            </p>
                        </div>
                    }
                </div>
                <div className={styles.controlPanel}>
                {
                    selectedFiles.length === 0 ?
                    <div className={`${styles.documentCounter} ${styles.documentCounterNormal}`} onClick={handleSelectedButton}>
                        <span className={styles.documentCounterText}>{documents.length}/10</span>
                        <span className={styles.documentCounterTextSmall}>Documents</span>
                    </div>
                    :
                    <div className={`${styles.documentCounter} ${styles.documentCounterSelected}`} onClick={handleSelectedButton}>
                        <span className={styles.documentCounterText}>{selectedFiles.length}/{documents.length}</span>
                        <span className={styles.documentCounterTextSmall}>Selected</span>
                    </div>
                }
            <CommandBarButton
                        role="button"
                        styles={{
                            icon: {
                                color: 'black',
                            },
                            iconHovered: {
                                color: 'black',
                            },
                            iconDisabled: {
                                color: "#BDBDBD !important",
                            },
                            root: {
                                background: "#FFFFFF"
                            },
                            rootHovered: {
                                background: COLOURS.purple,
                            },
                            rootDisabled: {
                                background: "#F0F0F0"
                            }
                        }}
                        className={styles.commandBarButton}
                        iconProps={{ iconName: 'Upload' }}
                        onClick={()=> {inputRef.current?.click()}}
                        disabled={documents.length > 9}
                        aria-label="document summary button"
                />
                <CommandBarButton
                        role="button"
                        styles={{
                            icon: {
                                color: 'black',
                            },
                            iconHovered: {
                                color: 'black',
                            },
                            iconDisabled: {
                                color: "#BDBDBD !important",
                            },
                            root: {
                                background: "#FFFFFF"
                            },
                            rootHovered: {
                                background: COLOURS.salmon,
                            },
                            rootDisabled: {
                                background: "#F0F0F0"
                            }
                        }}
                        className={styles.commandBarButton}
                        iconProps={{ iconName: 'Delete' }}
                        onClick={handleDelete}
                        disabled={selectedFiles.length === 0}
                        aria-label="document summary button"
                />  
                </div>
            </div>
            }
            <div className={styles.bottomRow}>
                <div
                    className={`${styles.button} ${isButtonDisabled ? styles.buttonDisabled : ''}`}
                    onClick={!isButtonDisabled ? onAskQuestions : undefined}
                    style={{ borderColor: buttonColor }}
                >
                    <span
                        className={`${styles.buttonText} ${isButtonDisabled ? styles.buttonTextDisabled : ''}`}
                        style={{ color: buttonColor }}
                    >                        
                        Ask questions about {selectedFiles.length > 1 ? 'these documents' : 'this document'} 
                    </span>
                </div>
                <div
                    className={`${styles.button} ${isButtonDisabled ? styles.buttonDisabled : ''}`}
                    onClick={!isButtonDisabled ? onSummarise : undefined}
                    style={{ borderColor: buttonColor }}
                >
                    <span
                        className={`${styles.buttonText} ${isButtonDisabled ? styles.buttonTextDisabled : ''}`}
                        style={{ color: buttonColor }}
                    >
                            Summarise {selectedFiles.length > 1 ? 'these documents' : 'this document'} 
                    </span>
                </div>
            </div>
        </div>
    );
}
export default DocumentUpload

