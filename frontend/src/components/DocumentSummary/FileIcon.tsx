import React from 'react';
import pdfIcon from '../../assets/pdf.png'
import docxIcon from '../../assets/doc.png'
import txtIcon from '../../assets/txt.png'
import csvIcon from '../../assets/csv.png'
import COLOURS from '../../constants/COLOURS';


type FileIconProps = {
    title: string;
    key: number;
    selected?: boolean;
};

const FileIcon: React.FC<FileIconProps> = ({ title, key, selected }) => {
    const getFileExtension = (filename: string) => {
        const extension = filename.split('.').pop();
        return extension?.toLowerCase();
    };

    const getIcon = (extension: string | undefined) => {
        switch (extension) {
            case 'pdf':
                return <i className="fa fa-file-pdf-o"></i>;
                //             <img src={
//                 fileType === 'application/pdf' ?
//                  pdfIcon : fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ?
//                   docxIcon : txtIcon} 
//                   alt={fileType} 
//                   key={key} 
//                   width={25} 
//                   height={25} 
//                   />
            case 'docx':
                return <i className="fa fa-file-word-o"></i>;
            case 'txt':
                return <i className="fa fa-file-text-o"></i>;
            default:
                return <i className="fa fa-file-o"></i>;
        }
    };

    const extension = getFileExtension(title);
    const shortTitle = title.length > 26 ? title.slice(0, 23) + '...' : title;


    return (
        <div style={{
            display:'flex', 
            alignContent:'center', 
            justifyContent:'center', 
            alignItems:'center', 
            flexDirection:'column', 
            backgroundColor: selected ? COLOURS.lightblue  : undefined,
            borderRadius: 20,
            padding: '10px 5px 0 5px'
        }}>
            <img 
                style={{alignSelf:'center', textAlign:'center'}}
                src={title.includes('.pdf') ?
                pdfIcon : title.includes('.docx') ?
                docxIcon : title.includes('.csv') ?
                csvIcon : txtIcon}
                alt={title}
                key={key}
                width={40}
                height={40} />
            <p style={{textAlign:'center', fontFamily:'DMSans-Regular', width:100, overflowWrap:'break-word', textOverflow:'ellipsis', fontSize:12, height:30}}>{shortTitle}</p>
        </div>
    );
};

export default FileIcon;