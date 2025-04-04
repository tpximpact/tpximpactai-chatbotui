import React from 'react';
import pdfIcon from '../../assets/pdf.png'
import docxIcon from '../../assets/doc.png'
import txtIcon from '../../assets/txt.png'
import csvIcon from '../../assets/csv.png'
import excelIcon from '../../assets/excel.png'
import COLOURS from '../../constants/COLOURS';


type FileIconProps = {
    title: string;
    key: number;
    selected?: boolean;
};

const FileIcon: React.FC<FileIconProps> = ({ title, key, selected }) => {
    const shortTitle = title.length > 26 ? title.slice(0, 23) + '...' : title;
    
    const getIconImg = (title: string) => {
        switch (true) {
            case title.endsWith('.pdf'):
                return pdfIcon;
            case title.endsWith('.docx'):
            return docxIcon;
            case title.endsWith('.csv'):
                return csvIcon;
            case title.endsWith('.xlsx'):
                return excelIcon;
            case title.endsWith('.txt'):
                return txtIcon;
            default:
                return txtIcon;
        }
    }

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
                src={getIconImg(title)}
                alt={title}
                key={key}
                width={40}
                height={40} />
            <p style={{textAlign:'center', fontFamily:'DMSans-Regular', width:100, overflowWrap:'break-word', textOverflow:'ellipsis', fontSize:12, height:30}}>{shortTitle}</p>
        </div>
    );
};

export default FileIcon;