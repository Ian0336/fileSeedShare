// Create a new file: frontend/src/app/components/FileViewer.tsx
'use client';
import React, { useState } from 'react';

interface FileViewerProps {
  fileData: {
    fileType: string;
    fileName: string;
    fileContent?: string;
    contentType?: string;
    directViewUrl?: string;
    text?: string;
  };
  seed: string;
}

export default function FileViewer({ fileData, seed }: FileViewerProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!fileData) return null;

  const handleCopyText = () => {
    if (fileData.fileContent) {
      navigator.clipboard.writeText(fileData.fileContent)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    } else if (fileData.text) {
      navigator.clipboard.writeText(fileData.text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    }
  };
  
  // Text content (stored as text directly)
  if (fileData.text) {
    const isUrl = fileData.text.toLowerCase().startsWith('http');
    
    return (
      <div className="rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
          <span className="font-medium text-gray-700 dark:text-gray-300">Text Content</span>
          <div className="flex space-x-2">
            <button 
              onClick={handleCopyText}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {isUrl && (
              <a 
                href={fileData.text}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
              >
                Open URL
              </a>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-600">
          <p className="whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
            {fileData.text}
          </p>
        </div>
      </div>
    );
  }
  
  // Text files
  if (fileData.fileType === 'text') {
    return (
      <div className="rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
          <span className="font-medium text-gray-700 dark:text-gray-300">{fileData.fileName}</span>
          <div className="flex space-x-2">
            <button 
              onClick={handleCopyText}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <a 
              href={`/api/download/${seed}`}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
            >
              Download
            </a>
          </div>
        </div>
        <div className="max-h-[500px] overflow-auto p-4 border-t border-gray-200 dark:border-gray-600">
          <pre className="whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200 text-sm font-mono">{fileData.fileContent}</pre>
        </div>
      </div>
    );
  }
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileData.fileType)) {
    const viewUrl = fileData.directViewUrl || `/api/view-file/${seed}`;
    
    return (
      <div className={`rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800 ${fullscreen ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/90' : ''}`}>
        <div className={`${fullscreen ? 'absolute top-0 left-0 right-0' : ''} p-4 bg-gray-50 dark:bg-gray-700 flex justify-between items-center`}>
          <span className="font-medium text-gray-700 dark:text-gray-300">{fileData.fileName}</span>
          <div className="flex space-x-2">
            <button 
              onClick={() => setFullscreen(!fullscreen)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <a 
              href={`/api/download/${seed}`}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
            >
              Download
            </a>
          </div>
        </div>
        <div className={`${fullscreen ? 'p-4 flex items-center justify-center h-full' : 'p-4 border-t border-gray-200 dark:border-gray-600'}`}>
          <img 
            src={viewUrl} 
            alt={fileData.fileName} 
            className={`${fullscreen ? 'max-h-[80vh] max-w-[90vw] object-contain' : 'max-w-full max-h-[500px] mx-auto object-contain'} rounded transition-all duration-300`}
          />
        </div>
      </div>
    );
  }
  
  // PDFs
  if (fileData.fileType === 'pdf') {
    const viewUrl = fileData.directViewUrl || `/api/view-file/${seed}`;
    
    return (
      <div className={`rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800 ${fullscreen ? 'fixed inset-0 z-50 flex flex-col' : ''}`}>
        <div className={`${fullscreen ? 'w-full' : ''} p-4 bg-gray-50 dark:bg-gray-700 flex justify-between items-center`}>
          <span className="font-medium text-gray-700 dark:text-gray-300">{fileData.fileName}</span>
          <div className="flex space-x-2">
            <button 
              onClick={() => setFullscreen(!fullscreen)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <a 
              href={`/api/download/${seed}`}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
            >
              Download
            </a>
          </div>
        </div>
        <div className={`${fullscreen ? 'flex-1' : 'h-[500px]'} border-t border-gray-200 dark:border-gray-600`}>
          <iframe 
            src={viewUrl} 
            className="w-full h-full border-0"
            title={fileData.fileName}
          ></iframe>
        </div>
      </div>
    );
  }
  
  // Audio files
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileData.fileType)) {
    const viewUrl = fileData.directViewUrl || `/api/view-file/${seed}`;
    
    return (
      <div className="rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
          <span className="font-medium text-gray-700 dark:text-gray-300">{fileData.fileName}</span>
          <a 
            href={`/api/download/${seed}`}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
          >
            Download
          </a>
        </div>
        <div className="p-8 border-t border-gray-200 dark:border-gray-600 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <audio controls className="w-full">
            <source src={viewUrl} type={`audio/${fileData.fileType}`} />
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>
    );
  }
  
  // Video files
  if (['mp4', 'webm', 'mov'].includes(fileData.fileType)) {
    const viewUrl = fileData.directViewUrl || `/api/view-file/${seed}`;
    
    return (
      <div className={`rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800 ${fullscreen ? 'fixed inset-0 z-50 flex flex-col' : ''}`}>
        <div className={`${fullscreen ? 'w-full' : ''} p-4 bg-gray-50 dark:bg-gray-700 flex justify-between items-center`}>
          <span className="font-medium text-gray-700 dark:text-gray-300">{fileData.fileName}</span>
          <div className="flex space-x-2">
            <button 
              onClick={() => setFullscreen(!fullscreen)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <a 
              href={`/api/download/${seed}`}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
            >
              Download
            </a>
          </div>
        </div>
        <div className={`${fullscreen ? 'flex-1 bg-black flex items-center justify-center' : 'p-4 border-t border-gray-200 dark:border-gray-600'}`}>
          <video 
            controls 
            className={`${fullscreen ? 'max-h-[80vh] max-w-[90vw]' : 'max-w-full max-h-[500px] mx-auto'}`}
          >
            <source src={viewUrl} type={`video/${fileData.fileType}`} />
            Your browser does not support the video element.
          </video>
        </div>
      </div>
    );
  }
  
  // For other file types, show download link
  return (
    <div className="rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800">
      <div className="p-4 bg-gray-50 dark:bg-gray-700">
        <span className="font-medium text-gray-700 dark:text-gray-300">{fileData.fileName}</span>
      </div>
      <div className="p-8 text-center border-t border-gray-200 dark:border-gray-600">
        <div className="mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="mb-4 text-gray-600 dark:text-gray-400">This file type ({fileData.fileType}) cannot be displayed directly.</p>
        <a
          href={`/api/download/${seed}`}
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Download {fileData.fileName}
        </a>
      </div>
    </div>
  );
}