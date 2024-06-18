import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {useDropzone} from 'react-dropzone'
import COLOURS from '../../constants/COLOURS'
import Loading from '../Loading'
import { deleteDocuments, getDocuments, uploadFiles } from '../../api'
import FileIcon from './FileIcon'
import { CommandBarButton } from '@fluentui/react'

  interface DocumentUploadProps {
    handleAskQuestions: (filenames: string[]) => void
    handleSummarise: (filenames: string[]) => void
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({handleAskQuestions, handleSummarise}) => {
    const [loading, setLoading] = useState(true)
    const [documents, setDocuments] = useState<string[]>([])
    const [selectedFiles, setSelectedFiles] = useState<string[]>([])


    useEffect(() => {
        getDocuments().then((res) => {
            if (res) {
                if (res.status === 200) {
                    res.json().then((data) => {
                        setDocuments(data)
                        setLoading(false)
                    })
                }
                else {
                    setLoading(false)
                }}})}, [])

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setLoading(false)

        setLoading(true)
        try {
            const timeoutPromise = new Promise<string>((resolve, reject) => {
                setTimeout(() => {
                    reject(new Error('Timeout exceeded'));
                }, 15000); // Timeout after 15 seconds
            
                
            const file_names = acceptedFiles.map(file => file.name)
            if (documents.length + file_names.length > 10) {
                alert('You can only upload a maximum of 10 documents')
                return
            }
            
            const fileList = new DataTransfer();
            for (let i = 0; i < acceptedFiles.length; i++) {
                console.log(acceptedFiles[i].name, documents)
                if (documents.includes(acceptedFiles[i].name)) {
                    alert("You already have a document with the name '" + acceptedFiles[i].name + "'. Please rename the document and try again.")
                    continue
                }
              fileList.items.add(acceptedFiles[i]);
            }
            uploadFiles(fileList.files).then((res) => {
                console.log(res)
                if (res.status === 200) {
                    setDocuments([...documents, ...file_names])
                    resolve('Documents uploaded successfully')
                }
            });
        });
        } catch (error) {
            console.error('Error reading files:', error);
        } finally {
            setLoading(false);
        }
    }, [setLoading, loading, documents, setDocuments]);
    
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
                    console.log(res)
                    alert('Error deleting documents')
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
        accept: {
            'text/plain': ['.txt'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/pdf': ['.pdf'],},
        maxFiles: 10,
        multiple: true,
        noDragEventsBubbling: true,
    });
          

    const style = useMemo(() => ({
        borderStyle: documents.length > 0 ? 'none' : 'dashed',
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
    

    return (
        <div style = {{height:'100%', width:'100%', display:'flex', flexDirection:'column'}}>
            { 
            loading ? 
            <div style = {{justifyContent:'center', alignContent:'center', height:'100%', width:'100%', alignItems:'center', display:'flex'}}>

                <div style= {{
                    height:'250px',
                    margin:'30px',
                    padding: '60px',
                    borderWidth: 2,
                    paddingTop: '100px',   
                }}>
                    <Loading size = {50} color='black'/> 
                </div>
            </div>
            :
            <div style = {{ display:'flex', flexDirection:'row', width:'100%'}}>
                    <div {...getRootProps({style})}>
                        <input {...getInputProps()} />

                    {isDragActive ?
                        <div style = {{justifyContent:'center', alignContent:'center', height:'100%', width:'100%', alignItems:'center', display:'flex', padding: '60px 30px'
                        }}>
                            <p style = {{textAlign:'center'}}>
                                Drop the file(s) here...
                            </p> 
                        </div>
                    :
                    documents.length > 0 ?
                        <div style={{ display: 'flex', flexDirection: 'row', padding: '10px', flexWrap:'wrap' , width:'100%'}}>
                            {documents.map((doc, index) => {
                                return (
                                    <div key={index} style={{ display: 'flex', margin: '5px', width:110 }} onClick={(e) => handleDocSelect(doc, e)}>
                                        <FileIcon title={doc} key={index} selected={selectedFiles.includes(doc)}/>
                                    </div>
                                )
                            })}
                        </div>
                    :
                        <div style = {{justifyContent:'center', alignContent:'center', height:'100%', width:'100%', alignItems:'center', display:'flex', padding: '60px 30px'
                        }}>

                            <p style={{ textAlign: 'center' }}>Drag and drop the document(s) you want to summarise here.<br />
                                    (Accepted formats are .pdf, .docx, .txt)
                                    <br />
                                    <br />
                                    or
                                    <br />
                                    <br />
                                    <span style={{ color: COLOURS.blue, textDecoration: 'underline', cursor: 'pointer' }}>Browse</span>
                            </p>
                        </div>
                    }
                </div>
                <div style={{display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', paddingLeft:'5%'}}>
                        {
                        selectedFiles.length == 0 ?
                            <div style= {{cursor:'pointer',  border: '1px solid #141414', display:'flex',borderWidth:1, borderRadius:15, flexDirection:'column', padding:'10px 5px 10px 5px', margin:'0px 10px 10px 10px', justifyContent:'center', alignContent:'center', width:80, boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.14), 0px 0px 2px rgba(0, 0, 0, 0.12)'
                            }}>
                                <span style={{fontWeight:'bold', textAlign:'center', fontSize:18}}>{documents.length}/10</span>
                                <span style={{fontSize:12, textAlign:'center'}}>Documents</span>
                             </div>
                            :
                            <div style= {{cursor:'pointer', border: '1px solid #141414', display:'flex', borderWidth:1, borderRadius:15, flexDirection:'column', backgroundColor:COLOURS.green,  padding:'10px 5px 10px 5px',  margin:'0px 10px 10px 10px', justifyContent:'center', alignContent:'center',  width:80, boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.14), 0px 0px 2px rgba(0, 0, 0, 0.12)'}}>
                                <span style={{fontWeight:'bold',  textAlign:'center',  fontSize:18}}>{selectedFiles.length}/{documents.length}</span>
                                <span style={{fontSize:12, textAlign:'center'}}>Selected</span>
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
                                    style={{    
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        width: '50px',
                                        height: '50px',
                                        color: '#FFFFFF',
                                        borderRadius: '50px',
                                        border: '1px solid #141414',
                                        borderBottomWidth: '4px',
                                        margin: '10px',
                                                                          }}
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
                                            background: '#ffcfca',
                                        },
                                        rootDisabled: {
                                            background: "#F0F0F0"
                                        }
                                    }}
                                    style={{    
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        width: '50px',
                                        height: '50px',
                                        color: '#FFFFFF',
                                        borderRadius: '50px',
                                        border: '1px solid #141414',
                                        borderBottomWidth: '4px',
                                        margin: '10px',
                                                                          }}
                                    iconProps={{ iconName: 'Delete' }}
                                    onClick={handleDelete}
                                    disabled={selectedFiles.length === 0}
                                    aria-label="document summary button"
                            />
                            

                </div>
            </div>
            }
            <div style= {{width:'100%', flexDirection:'row', display:'flex', justifyContent:'center'}}>
                <div style= {{
                    border: '1px solid #141414', 
                    display:'flex',
                    borderWidth:1, 
                    borderRadius:25, 
                    flexDirection:'column', 
                    padding:'20px', 
                    margin:'0px 10px 10px 10px', 
                    justifyContent:'center', 
                    alignContent:'center', 
                    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.14), 0px 0px 2px rgba(0, 0, 0, 0.12)',
                    width:'50%',
                    borderColor: selectedFiles.length > 0 ? COLOURS.black : '#BDBDBD'
                                }}
                    onClick={selectedFiles.length > 0 ? onAskQuestions : undefined}>
                    <span style={{
                        fontWeight:'bold', 
                        textAlign:'center', 
                        fontSize:16, 
                        fontFamily:'DMSans-Regular',
                        color: selectedFiles.length > 0 ? COLOURS.black : '#BDBDBD'
                        }}>Ask questions about {selectedFiles.length > 1 ? 'these documents' : 'this document'} </span>
                    </div>

                    <div style= {{  
                        border: '1px solid #141414', 
                        display:'flex',
                        borderWidth:1, 
                        borderRadius:25, 
                        flexDirection:'column', 
                        padding:'20px', 
                        margin:'0px 10px 10px 10px', 
                        justifyContent:'center', 
                        alignContent:'center', 
                        boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.14), 0px 0px 2px rgba(0, 0, 0, 0.12)',
                        width:'50%',
                        borderColor: selectedFiles.length > 0 ? COLOURS.black : '#BDBDBD'
                                }}
                        onClick={selectedFiles.length > 0 ? onSummarise : undefined}>
                    <span style={{
                        fontWeight:'bold', 
                        textAlign:'center', 
                        fontSize:16, 
                        fontFamily:'DMSans-Regular',
                        color: selectedFiles.length > 0 ? COLOURS.black : '#BDBDBD'
                    }}
                        >
                            Summarise {selectedFiles.length > 1 ? 'these documents' : 'this document'} 
                    </span>

                    </div>
                </div>
        </div>
    );
}
export default DocumentUpload

const baseStyle = {
    margin: '30px 1px',
    borderWidth: 1,
    borderRadius: '50px',
    borderColor: 'black',
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
