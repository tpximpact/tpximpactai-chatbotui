import React from 'react';
import { Modal, IconButton } from '@fluentui/react';
import styles from './DocumentSummaryModal.module.css'; 

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DocumentSummaryModal: React.FC<CustomModalProps> = ({ isOpen, onClose }) => {

    return (
        <Modal
        styles= {{ root: {overflowY: 'hidden'}, main: {borderRadius:'20px', width: '70%',overflowY: 'hidden'} } }
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
                <h1>
                    Document Summary
                </h1>
        </div>
        <div className={styles.modalContent}>
        </div>
        </div>
        </Modal>
    );
    }

export default DocumentSummaryModal;