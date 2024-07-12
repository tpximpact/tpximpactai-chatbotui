import React, { useCallback, useMemo, useState } from 'react'
import {useDropzone} from 'react-dropzone'
import { min } from 'lodash'
import pdfIcon from '../../assets/pdf.png'
import docxIcon from '../../assets/doc.png'
import txtIcon from '../../assets/txt.png'
// @ts-ignore
import pdfToText from "react-pdftotext"
import mammoth from 'mammoth'


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

export { readTxt, readPdf, readDocx }