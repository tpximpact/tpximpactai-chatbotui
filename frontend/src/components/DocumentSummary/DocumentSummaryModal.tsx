import React, { useEffect } from 'react';
import { Modal, IconButton, on } from '@fluentui/react';
import styles from './DocumentSummaryModal.module.css'; 
import DocumentUpload from './DocumentUpload';
import { ShareButton } from '../common/Button';
import { deleteDocuments, documentSummaryReduceApi, getUserIdentity } from '../../api';
import LoadingBar from '../LoadingBar';
import Loading from '../Loading';
import { set } from 'lodash';
import { XMarkIcon, ChevronLeftIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

interface CustomModalProps {
    disabled:boolean
  isOpen: boolean;
  onClose: () => void;
  setFilenames: (filenames: string[]) => void;
  filenames: string[];
  onSend: (question: string, id?: string) => void;
  conversationId?: string;
}

const DocumentSummaryModal: React.FC<CustomModalProps> = ({ isOpen, onClose, onSend, conversationId, setFilenames, filenames, disabled }) => {
    const [uploadWS, setUploadWS] = React.useState<WebSocket | null>(null);
    const [uploading, setUploading] = React.useState<string[]>([]);
    const [summarising, setSummarising] = React.useState<string[]>([]);
    const [short, setShort] = React.useState<boolean>(false);
    const [method, setMethod] = React.useState<string>('');
    const [prompt, setPrompt] = React.useState<string>('');
    const [progress, setProgress] = React.useState<number>(0);
    const [refining, setRefining] = React.useState<boolean>(false);
    const [reducing, setReducing] = React.useState<boolean>(false);
    const [refineWS, setRefineWS] = React.useState<WebSocket | null>(null);
    const [docData, setDocData] = React.useState<{[key: string]: string}>({});

    const reset = () => {
        setTimeout(() => {
        setSummarising([]);
        setMethod('');
        setPrompt('');
        setProgress(0);
        setRefining(false);
        setReducing(false);
        setRefineWS(null);
        setUploadWS(null);
        setUploading([]);
        },1000);
    }

    useEffect(() => {
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

        if (refining) {
            const initiateWebSocket = async () => {
                const user_id = await fetchData();
                if (!user_id) {
                    return;
                }

                const ws = new WebSocket("/documentsummary/refine");
                setRefineWS(ws);

                ws.onmessage = (event) => {
                    setProgress(event.data);
                    if (event.data.startsWith('done:')) {
                        const messageData = event.data.slice(5);
                        ws.close();
                        handleSend(messageData); 
                        reset();
                    } else {
                        setProgress(eval(event.data));
                    }
                };
                ws.onopen = () => {
                    const data = {
                        prompt: prompt,
                        filenames: summarising,
                        container: user_id,
                    };

                    const jsonData = JSON.stringify(data);
                    ws.send(jsonData);
                };
            };

            initiateWebSocket();
        }
    }, [refining]);


    const onSubmit = () => {
        setFilenames([])
        if (method === 'refine') {
            setRefining(true);
            return
        }
        setReducing(true);
        documentSummaryReduceApi(summarising, prompt)
        .then((res) => {
            if (!res.ok) {
                throw new Error('Network response was not ok');
            }
            return res.json();
        }).then((data) => {
            // const summary = data.response.replace(/(?:\r\n|\r|\n)/g, '<br>');
            handleSend(data.response);
            reset();
        })
    }

    const handleSend = (summary: string) => {
        if (conversationId){
            onSend(summary, conversationId);
        } else {
            onSend(summary);
        }
        onClose();
        setTimeout(() => {
        setFilenames(summarising)
        }, 2000);
    }

    const handleAskQuestions = (filenames: string[]) => {
        setFilenames(filenames);
        onClose();
    }

    const handleSummarise = (filenames: string[]) => {
        let totalChunks = 0;
        for (const filename of filenames) {
            console.log(docData[filename])
            totalChunks =+ parseInt(docData[filename]);
        }
        console.log('total:', totalChunks)
        if (totalChunks > 4) { 
            setSummarising(filenames);
        }else{
            console.log('short')
            setShort(true);
            setSummarising(filenames);
        }
        
    }

    const handleClose = () => {
        if (refining) {
            const userConfirmed = confirm('Are you sure you want to cancel summarisation?');
            if (userConfirmed) {
                refineWS!.send(JSON.stringify({ command: 'abort' }));
                onClose();
                reset();
            }
        } else if(uploading.length > 0){
            const userConfirmed = confirm('Are you sure you want to cancel uploading?');
            if (userConfirmed) {
                uploadWS!.send(JSON.stringify({ command: 'abort' }));
                deleteDocuments(uploading)
                onClose();
                reset();
            }
        }
            else {
            reset();
            onClose();
        }
    }

    return (
        <Modal
        styles={{
            root: {
                overflowY: 'hidden',
                borderWidth: '1px',
                borderColor: 'black',
            },
            main: {
                borderRadius: '30px',
                width: '55%',
                overflowY: 'hidden',
            }
        }}
            isOpen={isOpen}
            onDismiss={onClose}
            isBlocking={false}
        >
            <div className={styles.modalContainer}>
                <IconButton
                    onMouseOver={undefined}
                    onRenderIcon={() => <XMarkIcon color="black" height={25} width={25}/>}
                    ariaLabel="Close"
                    onClick={handleClose}
                    styles={{ root: { position: 'absolute', top: '10px', right: '20px', borderRadius:'10px'} }}
                    className={styles.closeButton} 
                />

                {uploading.length > 0 ? 
                    <>
                        <div className={styles.modalHeader}>
                            <p>
                                Uploading...
                            </p>
                        </div>
                        <div className={styles.loadingBarContainer}>
                            <LoadingBar progress={progress} />
                        </div>
                    </>
                :            
                summarising.length > 0 ? 
                method || short ? 
                refining ?
                <>
                    <div className={styles.modalHeader}>
                        <p>
                            Summarising...
                        </p>
                    </div>
                    <div className={styles.loadingBarContainer}>
                            <LoadingBar progress={progress} />
                    </div>
                </>
                :
                reducing ?
                <>
                <div className={styles.modalHeader}>
                    <p>
                        Summarising...
                    </p>
                </div>
                <div className = {styles.loadingContainer}>
                    <Loading size = {50} color='black' />
                </div>
                </>
                :
                <>
                <div className={styles.modalHeader}>
                        <p>
                            Add a prompt (optional)
                        </p>
                </div>
                <div className = {styles.modalContent}>
                <p>You can give ImpactAI specific instructions on how you would like to summarise the documents.</p>
                <p> 
                <strong>
                    For example:{' '}
                    </strong>
                    {' '}You can tell it use a particular tone, or to focus the summarisation on a certain topic.
                </p>
                <p><strong>
                    Your prompt:
                    </strong>
                    </p>
                </div>
                    <input 
                        className={styles.promptInput} 
                        type="text" 
                        placeholder="Add a prompt (or leave blank and press summarise)" 
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    
                    <div className = {styles.promptBottomBarContainer}>
                        <IconButton
                            onMouseOver={undefined}
                            onRenderIcon={() => <ArrowLeftIcon color="black" height={25} width={25}/>}
                            ariaLabel="Close"
                            onClick={() => {
                                if (short) {
                                    setSummarising([]);
                                    setShort(false);
                                } else {
                                    setMethod('');
                                }}}
                            styles={{ root: { borderRadius: '10px', margin: '10px 10px 10px 0px' } }}
                            className={styles.closeButton} // Apply custom CSS class for close button
                            />
                        <ShareButton onClick={onSubmit} text={'Summarise'} style={{marginLeft:'auto'}} disabled={disabled}/>

                    </div>
                </>
                :
                <>  
                    <div className={styles.modalHeader}>
                        <p>
                        Choose your summarisation method
                        </p>
                    </div>
                    
                    <div className={styles.modalContent}>
                        Long document(s) like yours require a different approach to summarisation. <br/>
                        Different ways of summarising can produce different results. <br/>
                        Select the method that suits your needs:
                    </div>
                    <div className={styles.methodContainer}>
                        <div className={styles.methodBubble} onClick={() => setMethod('reduce')}>
                            <h3>Reduce</h3>
                            <ul>
                                <li>Same speed for any size document</li>
                                <li>May be less accurate</li>
                            </ul>
                        </div>
                        <div className={styles.methodBubble}  onClick={() => setMethod('refine')}>
                             <h3>Refine</h3>
                             <ul>
                                <li>Takes longer the longer the document is</li>
                                <li>Can be more accurate</li>
                            </ul>
                        </div>
                    </div>
                        <IconButton
                            onMouseOver={undefined}
                            onRenderIcon={() => <ArrowLeftIcon color="black" height={25} width={25}/>}
                            ariaLabel="Close"
                            onClick={() => setSummarising([])}
                            styles={{ root: {borderRadius:'10px', margin:'10px 10px 10px 0px'} }}
                            className={styles.closeButton} // Apply custom CSS class for close button
                            />
                         </> 
                    
                    :
                <>
                    <div className={styles.modalHeader}>
                        <p>
                            Your Documents
                        </p>
                    </div>
                    <div className={styles.modalContent}>
                        If you have a document that’s too big for a single prompt, you can upload it here to have it summarised or ask questions about it. <br /> Only you can see documents you upload.
                    </div>
                    <DocumentUpload 
                    handleAskQuestions={handleAskQuestions} 
                    handleSummarise={handleSummarise}
                    setUploadWS={setUploadWS}
                    setUploading={setUploading}
                    setProgress={setProgress}
                    setDocData={setDocData}
                    />
                </>
                }
            </div>
        </Modal>
    );
    }

export default DocumentSummaryModal;