'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import FileViewer from '../view/_components/FileViewer';

async function getData(seed: string) {
  const response = await fetch(`/api/file-name`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ seed_code: seed })
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
}

export default function Home({ params }: any) {
  const router = useRouter();
  const [data, setData] = React.useState<any>(null);
  const [seed, setSeed] = React.useState<string | null>(null);
  const [error, setError] = React.useState<any>(null);
  const [copySuccess, setCopySuccess] = React.useState('');

  React.useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setSeed(decodeURIComponent(resolvedParams.seed));
    };

    resolveParams();
  }, [params]);

  React.useEffect(() => {
    if (seed) {
      const _getData = async () => {
        try {
          const data = await getData(seed);
          const dataType = data['file'] ? 'file' : 'text';
          const dataContent = dataType === 'file'
            ? (
              <a
                href={`/api/download/${seed}`}
                className="text-blue-500 hover:underline break-all"
              >
                {data.file.split('uploads/')[1].split('-').slice(1).join('-')}
              </a>
            )
            : (
              <span className="break-all cursor-pointer" onClick={() => {
                navigator.clipboard.writeText(data.text)
                  .then(() => {
                    alert('Copied!');
                    if (data.text.toLowerCase().startsWith('https://')) {
                      if (window.confirm(`Open ${data.text} in new tab?`)) {
                        window.open(data.text, '_blank');
                      }
                    }
                  })
                  .catch(() => alert('Failed to copy text.'))
              }}>
                {data.text}
              </span>
            );

          setData({ type: dataType, content: dataContent });
        } catch (error) {
          console.error(error);
          if (error instanceof Error) {
            setError(error.message);
          } else {
            setError(String(error));
          }
        }
      };
      _getData();
    }
  }, [seed]);

  const copyToClipboard = () => {
    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => setCopySuccess('Copied!'))
      .catch(() => setCopySuccess('Failed to copy URL.'));
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 sm:px-8 py-6 sm:py-12 font-sans mt-7">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-lg p-6 sm:p-8 relative">
        <button
          onClick={() => router.push('/')}
          className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 cursor-pointer focus:outline-none transition-colors"
          aria-label="Go Back"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Seed Data Viewer</h1>
        <div className="space-y-4">
          <div className="flex items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="text-gray-700 mr-2">
              Your Seed:
            </p>
            <span className="font-medium text-black bg-gray-100 px-2 py-1 rounded">{seed}</span>
          </div>
          
          {data ? (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 mb-2">
                Data:
              </p>
              <div className="break-all">
                {data.content}
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-red-500">Error: {error}</p>
            </div>
          ) : (
            <div className="animate-pulse bg-gray-100 p-4 rounded-lg">
              <p className="text-gray-500">Loading...</p>
            </div>
          )}
          
          <button
            onClick={copyToClipboard}
            className="w-full py-3 rounded-lg font-medium text-black bg-gray-200 hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center"
          >
            <span>{copySuccess || 'Copy URL'}</span>
          </button>
        </div>
      </div>
      
      {data && data.viewData && (
        <div className="w-full max-w-2xl mt-6">
          <h2 className="text-lg font-medium text-gray-700 mb-3">File Preview</h2>
          <FileViewer fileData={data.viewData} seed={seed || ''} />
        </div>
      )}
    </div>
  );
}
