import React, { useEffect, useRef, useState } from 'react';
import { Modal, IconButton, Button } from '@fluentui/react';
import styles from './QuestionInput.module.css'; // Import custom CSS styles for the modal
import { ShareButton } from '../common/Button';
import useCaseData from './useCaseData.json'

// Define Props for Modal Component
interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  sendExampleQuestion: (question: string) => void;
}

interface UseCaseProps {
  questionNum: number;
  setPage: (page: number)=> void;
}

const UseCaseCard: React.FC<UseCaseProps> = ({ questionNum, setPage }) => {
  const data = useCaseData.useCases[questionNum];
  return (
    <div className={styles.useCaseContainer} onClick={() => setPage(questionNum)}>
      <p className={styles.useCaseText}>
        <strong>{data.title}</strong>
        <br />
        {data.subtitle}
      </p>
    </div>
  );
};

interface UseCasePageProps extends UseCaseProps {
  width?: number;
  height?: number;
  sendExampleQuestion: (question: string) => void;
}

const UseCasePage: React.FC<UseCasePageProps>  = ({questionNum, width, height, setPage, sendExampleQuestion}) => {
  const data = useCaseData.useCases[questionNum];
  console.log(height)
  return (
    <div className={styles.useCasePageContainer} style={{height: height, justifyContent:'space-between', alignContent:'space-between', display:'flex', flexDirection:'column'}}>

      <div>

        <div style ={{display: 'flex', flexDirection: 'row'}}>
                <IconButton
              onMouseOver={undefined}
              iconProps={{ iconName: 'Back', styles: { root: { color: 'black'}}}}
              ariaLabel="Close"
              onClick={() => setPage(-1)}
              styles={{ root: {borderRadius:'10px', margin:'15px 10px 10px 0px'} }}
              className={styles.closeButton} // Apply custom CSS class for close button
              />
          <h2>{data.title}</h2>
        </div>
        <p>{data.content}
        {data.note && <><br /><strong>Note:</strong> {data.note}</>}
        </p>
        <p><strong>Example usage</strong></p>
        <p style = {{paddingBottom:"10px"}}>{data.example}</p>
      </div>

      <div style={{marginTop:'auto', marginBottom:'2%'}}>

        <ShareButton
          onClick={() => {
            sendExampleQuestion(data.prompt)
            setPage(-1)
          }}
          text="See it work"
          color="random"
          />
      </div>

    </div>
  )
}


// Custom Modal Component
const UseCaseModal: React.FC<CustomModalProps> = ({ isOpen, onClose, sendExampleQuestion }) => {

  const dimensions = useRef({ width: 0, height: 0 });
  const elementRef = useRef<HTMLDivElement>(null); // Specify the type of the ref explicitly
  const measureDiv = () => {
    const element = elementRef.current;
    if (element) {
      const { width, height } = element.getBoundingClientRect();
      dimensions.current= { width, height }
    }

  }

  const [page, setPage] = useState(-1)
  function chunkArray(array:any[], size:number) {
    const chunkedArray = [];
    for (let i = 0; i < array.length; i += size) {
      chunkedArray.push(array.slice(i, i + size));
    }
    return chunkedArray;
  }
  return (
    <Modal
    styles= {{ root: {overflowY: 'hidden'}, main: {borderRadius:'20px', width: '90%', height:'90%',overflowY: 'hidden'} } }
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
      <div className={styles.modalHeader}>
        <h2 style={{ textAlign: 'center' }}> Some Uses For TPXimpactAI That You Can Try</h2>
      </div>
      <div className={styles.modalContent}>

        <h3 style={{padding:'15px 0px 5px 0px'}}>AI can be a powerful tool. To get the most out of it, you should phrase your questions (prompts) a little diferently than you would normally. 
        <br />
        <br />
        Here are some things it's good at, click on a bubble to learn more:
        </h3>
        
        <div ref={elementRef} onMouseEnter={measureDiv}>
   
        {
          page === -1 ? (
            chunkArray(useCaseData.useCases, 5).map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className={styles.useCaseRowContainer}>
              {row.map((data: any, cardIndex: number) => (
                <UseCaseCard key={`card-${rowIndex}-${cardIndex}`} questionNum={rowIndex * 5 + cardIndex} setPage={setPage} />
              ))}
            </div>
          ))
        ):(
          <UseCasePage questionNum={page} width={dimensions.current.width} height={dimensions.current.height} setPage={setPage} sendExampleQuestion={sendExampleQuestion} />
        )}

        </div>
        {/* <p>
            <strong>Remember:</strong> Always check your responses for mistakes and hallucinations. If in doubt, don't hesitate to challenge the response or ask for clarifications. TPXimpactAI can provide additional context or elaborate on its answers.
        </p> */}
        <div style={{ textAlign: 'center' , marginBottom:'30px', marginTop:'30px'}}>

        <ShareButton
          onClick={() => {
            onClose()
          }}
          text="Get started"
          color="random"
        />
      </div>
      </div>
    </div>
    
    </Modal>
  );
};

export default UseCaseModal;
