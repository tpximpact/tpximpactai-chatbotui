import React, { useCallback, useMemo, useState } from 'react'
import {useDropzone} from 'react-dropzone'
import COLOURS from '../../constants/COLOURS'
import { min } from 'lodash'
import pdfIcon from '../../assets/pdf.png'
import docxIcon from '../../assets/doc.png'
import txtIcon from '../../assets/txt.png'
import Loading from '../Loading'
// @ts-ignore
import pdfToText from "react-pdftotext"
import mammoth from 'mammoth'

// function FileIcon( {fileName, fileType, key }: { fileName: string, fileType: string, key: string}) {
//     if (fileName.length > 25) {
//         fileName = fileName.slice(0,22) + '...'
//     }
//     return (
//         <div style={{display:'flex', flexDirection: 'row', padding:"1px 1px"}}>
//             <img src={
//                 fileType === 'application/pdf' ?
//                  pdfIcon : fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ?
//                   docxIcon : txtIcon} 
//                   alt={fileType} 
//                   key={key} 
//                   width={25} 
//                   height={25} 
//                   />
//             <span>{fileName}</span>
//         </div>
//     )
// }

const baseStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 30px',
    margin: '30px 1px',
    borderWidth: 1,
    borderRadius: '50px',
    borderColor: 'black',
    borderStyle: 'dashed',
    outline: 'none',
    transition: 'border .24s ease-in-out',
    cursor: 'pointer',
    height:'250px',
    width:'100%',
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
    setDocString: React.Dispatch<React.SetStateAction<string>>;
    // Add other props if needed
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ setDocString }) => {
    const [loading, setLoading] = useState(false)

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setLoading(true);
        console.log('TEXT:', acceptedFiles[0].text())
    
        try {
            const timeoutPromise = new Promise<string>((resolve, reject) => {
                setTimeout(() => {
                    reject(new Error('Timeout exceeded'));
                }, 15000); // Timeout after 15 seconds
            });
    
            const fileReadPromises: Promise<string>[] = [];
    
            // Iterate through each file in acceptedFiles
            acceptedFiles.forEach((file, index)=> {
                // Determine which function to use based on file type
                const fileReadPromise = 
                file.type === 'application/pdf' ? readPdf(file) :
                file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? readDocx(file) : 
                readTxt(file);
                            // Add the file reading promise to the array
                fileReadPromises.push(fileReadPromise.then(content => `DOCUMENT: ${index}, TITLE: ${file.name}\n${content}`));
            });
    
            // Wait for all file reading promises to resolve or timeout
            const fileContents = await Promise.race([
                Promise.all(fileReadPromises),
                timeoutPromise
            ]);
    
            // Concatenate the file contents
            let concatenatedString: string;
            if (typeof fileContents === 'string') {
                concatenatedString = fileContents; // If there's only one file, fileContents is a string
            } else {
                concatenatedString = fileContents.join(''); // If there are multiple files, join the array of strings
            }
        
            // Set the concatenated string
            setDocString(concatenatedString);
    
            // Log the concatenated string (truncated to 100 characters)
            console.log('Concatenated string:', concatenatedString.slice(0, 100));
        } catch (error) {
            console.error('Error reading files:', error);
        } finally {
            setLoading(false);
        }
    }, [setDocString, setLoading]);
    
    async function readTxt(file: any): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error('Failed to read file'));
                }
            };
            reader.onerror = () => {
                reject(reader.error || new Error('Unknown file read error'));
            };
            reader.readAsText(file);
        });
    }

    function readPdf(file: File): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            pdfToText(file)
            .then((text: any) => resolve(text))
            .catch((error: any) => reject(error));

        });
    }

    async function readDocx(file: File): Promise<string> {
        try {
            const reader = new FileReader();
    
            return new Promise<string>((resolve, reject) => {
                reader.onload = async (event) => {
                    const arrayBuffer = event.target?.result as ArrayBuffer;
    
                    if (arrayBuffer) {
                        try {
                            const result = await mammoth.extractRawText({ arrayBuffer });
                            resolve(result.value);
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        reject(new Error('Failed to read file'));
                    }
                };
    
                reader.onerror = () => {
                    reject(new Error('Error reading file'));
                };
    
                reader.readAsArrayBuffer(file);
            });
        } catch (error) {
            console.error('Error extracting text from DOCX:', error);
            throw error;
        }
    }

    // function readDocx(file: File): Promise<string> {
    //     return new Promise<string>((resolve, reject) => {
    //         mammoth.extractRawText({path: file)})
    //         .then((result: any) => resolve(result.value))
    //         .catch((error: any) => reject(error));
    //     });
    // }

    const {    
        isFocused,
        isDragAccept,
        isDragReject,
        acceptedFiles,
        getRootProps,
        getInputProps, 
        isDragActive
    } = useDropzone({
        onDrop,
        accept: {
            'text/plain': ['.txt'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/pdf': ['.pdf'],},
        maxFiles: 10,
        multiple: true,
        noDragEventsBubbling: true,
    });
    
    // const files = acceptedFiles.length > 5 ? (
    //     <div style={{display: 'flex', flexDirection:'row', alignContent:'space-between', justifyContent:'space-between'}}>
    //       <div style={{ display: 'flex', flexDirection: 'column', paddingRight:'20px' }}>
    //         {acceptedFiles.slice(0, 5).map(file => (
    //           <FileIcon key={file.name} fileName={file.name} fileType={file.type} />
    //         ))}
    //       </div>
    //       <div style={{ display: 'flex', flexDirection: 'column'}}>
    //         {acceptedFiles.slice(5).map(file => (
    //           <FileIcon key={file.name} fileName={file.name} fileType={file.type} />
    //         ))}
    //         {acceptedFiles.length === 10 ? null : <span style= {{color:'grey', paddingLeft: '3px', paddingTop:'3px'}}> (Room for {10 - acceptedFiles.length} more)</span>}

    //       </div>
    //     </div>
    //   ) : (
    //     <div style={{ display: 'flex', flexDirection: 'column', paddingLeft:'20px' }}>
    //       {acceptedFiles.map(file => (
    //         <FileIcon key={file.name} fileName={file.name} fileType={file.type} />
    //       ))}
    //       <span style= {{color:'grey', paddingLeft: '3px', paddingTop:'3px'}}> (Room for {10 - acceptedFiles.length} more)</span>
    //     </div>
    //   );
      

    const style = useMemo(() => ({
        ...baseStyle,
        ...(isFocused ? focusedStyle : {}),
        ...(isDragAccept ? acceptStyle : {}),
        ...(isDragReject ? rejectStyle : {})
      }), [
        isFocused,
        isDragAccept,
        isDragReject
      ]);
    

    return (
        <div style = {{justifyContent:'center', alignContent:'center', height:'100%', width:'100%', alignItems:'center', display:'flex'}}>
            { 
            loading ? 
                <div style= {{
                    height:'250px',
                    margin:'30px',
                    padding: '60px',
                    borderWidth: 2,
                    paddingTop: '100px',   
                }}>
                    <Loading size = {50} color='black'/> 
                </div>
            :
                <div {...getRootProps({style})}>
                    <input {...getInputProps()} />
                    {isDragActive ?
                        <p style = {{textAlign:'center'}}>
                            Drop the file(s) here...
                        </p> 
                    :
                        <p style = {{textAlign:'center'}}>Drag and drop the document(s) you want to summarise here.<br/> 
                        (Accepted formats are .pdf, .docx, .txt)
                        <br/> 
                        <br/>
                        or 
                        <br/>
                        <br/>
                        <span style={{ color: COLOURS.blue, textDecoration: 'underline', cursor: 'pointer' }}>Browse</span>
                        </p>
                    }
                </div>
            }
        </div>            
    );
}
export default DocumentUpload