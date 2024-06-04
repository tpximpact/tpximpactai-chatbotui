import React, { useEffect } from 'react';
import { Modal, IconButton, on } from '@fluentui/react';
import styles from './DocumentSummaryModal.module.css'; 
import DocumentUpload from './DocumentUpload';
import { ShareButton } from '../common/Button';
import { documentSummaryReduceApi } from '../../api';
import LoadingBar from '../LoadingBar';
import Loading from '../Loading';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (question: string, id?: string) => void;
  conversationId?: string;
}

const DocumentSummaryModal: React.FC<CustomModalProps> = ({ isOpen, onClose, onSend, conversationId }) => {
    const [docString, setDocString] = React.useState<string>('');
    const [method, setMethod] = React.useState<string>('');
    const [prompt, setPrompt] = React.useState<string>('');
    const [progress, setProgress] = React.useState<number>(0);
    const [refining, setRefining] = React.useState<boolean>(false);
    const [reducing, setReducing] = React.useState<boolean>(false);
    const reset = () => {
        setDocString('');
        setMethod('');
        setPrompt('');
        setProgress(0);
        setRefining(false);
        setReducing(false);
    }
    useEffect(() => {
        if (refining) {
            const ws = new WebSocket("/documentsummary/refine");
            ws.onmessage = (event) => {
                setProgress(event.data);
                if (event.data.startsWith('done:')) {
                    const messageData = event.data.slice(5);
                    ws.close();
                    handleSend(messageData); 
                    setInterval(() => {
                        reset();
                    }, 1000);
                }else{
                    setProgress(eval(event.data));
                }
            };
            ws.onopen = () => {
                const data = {
                    prompt: prompt,
                    document: docString
                };
            
                const jsonData = JSON.stringify(data);
            
                ws.send(jsonData);
            };
                    }
    }, [refining]);


    const handleSummarise = () => {
        if (method === 'refine') {
            setRefining(true);
            return
        }
        setReducing(true);
        documentSummaryReduceApi(docString, prompt)
        .then((res) => {
            if (!res.ok) {
                throw new Error('Network response was not ok');
            }
            return res.json();
        }).then((data) => {
            // const summary = data.response.replace(/(?:\r\n|\r|\n)/g, '<br>');
            handleSend(data.response);
            setInterval(() => {
                reset();
            }, 3000);

        })
    }

    const handleSend = (summary: string) => {
        if (conversationId){
            onSend(summary, conversationId);
        } else {
            onSend(summary);
        }
        onClose();

    }


    return (
        <Modal
        styles= {{ root: {overflowY: 'hidden', borderWidth: '1px', borderColor:'black',}, main: {borderRadius:'30px', width: '55%',overflowY: 'hidden'} } }
            isOpen={isOpen}
            onDismiss={onClose}
            isBlocking={false}
        >
            <div className={styles.modalContainer}>
                <IconButton
                    onMouseOver={undefined}
                iconProps={{ iconName: 'Cancel', styles: { root: { color: 'black'}}}}
                ariaLabel="Close"
                onClick={onClose}
                styles={{ root: { position: 'absolute', top: '10px', right: '20px', borderRadius:'10px'} }}
                className={styles.closeButton} // Apply custom CSS class for close button
                />

                {docString ? 
                method ? 
                refining ?
                <>
                    <div className={styles.modalHeader}>
                                    <p>
                                        Summarising...
                                    </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignContent: 'center', alignItems: 'center', padding:'13% 7%' }}>

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
                <div style={{ display: 'flex', justifyContent: 'center', alignContent: 'center', alignItems: 'center', paddingTop:'3%', paddingBottom:'9%'}}>
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
                    <input style= {{
                        width: '100%',
                        padding: '12px 20px',
                        margin: '8px 0',
                        display: 'inline-block',
                        border: '1px solid #000000',
                        borderRadius: '20px',
                        boxSizing: 'border-box',
                        
                    }} type="text" placeholder="Add a prompt (or leave blank and press summarise)" onChange={(e) => setPrompt(e.target.value)}></input>
                    <div style ={{display: 'flex', flexDirection:'row', justifyContent:'space-between', alignContent:'space-between', alignItems:'space-between', width:'100%', marginTop:'10px'}}>
                        <IconButton
                            onMouseOver={undefined}
                            iconProps={{ iconName: 'Back', styles: { root: { color: 'black' } } }}
                            ariaLabel="Close"
                            onClick={() => setMethod('')}
                            styles={{ root: { borderRadius: '10px', margin: '10px 10px 10px 0px' } }}
                            className={styles.closeButton} // Apply custom CSS class for close button
                            />
                        <ShareButton onClick={handleSummarise} text={'Summarise'} style={{marginLeft:'auto'}}/>

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
                            iconProps={{ iconName: 'Back', styles: { root: { color: 'black'}}}}
                            ariaLabel="Close"
                            onClick={() => setDocString('')}
                            styles={{ root: {borderRadius:'10px', margin:'10px 10px 10px 0px'} }}
                            className={styles.closeButton} // Apply custom CSS class for close button
                            />
                         </> 
                    
                    :
                <>
                    <div className={styles.modalHeader}>
                        <p>
                            Document Summarisation
                        </p>
                    </div>
                    <div className={styles.modalContent}>
                        If you have a document that’s too big for a single prompt, you can upload it here to have it summarised.<br /> You can select up to 10 documents at once.
                    </div>
                    <DocumentUpload setDocString={setDocString} />
                </>
                }

            </div>
        </Modal>
    );
    }

export default DocumentSummaryModal;