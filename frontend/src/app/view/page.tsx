'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import FileViewer from './_components/FileViewer';

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
  const data = await response.json();

  // Don't try to fetch binary files directly - they'll be handled with specific URLs in the component
  // Just check if it's an image or PDF based on the file path
  if (data.file) {
    const filePath = data.file;
    const extension = filePath.split('.').pop()?.toLowerCase();
    const isDirectViewable = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'pdf'].includes(extension);
    
    if (isDirectViewable) {
      // For directly viewable files, set the view URL but don't fetch content
      return {
        ...data,
        viewData: {
          fileType: extension,
          fileName: filePath.split('uploads/')[1].split('-').slice(1).join('-'),
          directViewUrl: `/api/view-file/${seed}`
        }
      };
    } else {
      // For other file types, fetch metadata from view-file endpoint
      const viewResponse = await fetch(`/api/view-file/${seed}`, {
        method: 'GET',
      });
      
      if (viewResponse.ok) {
        const viewData = await viewResponse.json();
        return { ...data, viewData };
      }
    }
  } else if (data.text) {
    // For text messages, just return the data as is
    return {
      ...data,
      viewData: {
        text: data.text,
        fileType: 'text'
      }
    };
  }
  
  return data;
}

export default function ViewPage() {
  const router = useRouter();
  const [data, setData] = React.useState<any>(null);
  const [seed, setSeed] = React.useState<string | null>(null);
  const [error, setError] = React.useState<any>(null);
  const [copySuccess, setCopySuccess] = React.useState('');

  React.useEffect(() => {
    // 从 localStorage 获取 seed
    const storedSeed = localStorage.getItem('current_seed');
    if (!storedSeed) {
      router.push('/'); // 如果没有 seed，返回首页
      return;
    }
    setSeed(storedSeed);
  }, [router]);

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

          setData({ type: dataType, content: dataContent, viewData: data.viewData });
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

  const handleAction = () => {
    if (!data) return;
    
    if (data.type === 'text') {
      navigator.clipboard.writeText(data.content.props.children)
        .then(() => setCopySuccess('Text copied!'))
        .catch(() => setCopySuccess('Failed to copy text.'));
    } else if (data.type === 'file') {
      // 觸發文件下載
      window.location.href = `/api/download/${seed}`;
      setCopySuccess('Downloaded!');
    }
  };
  console.log(data);
  return (
    <>
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
          
          {data && (
            <button
              onClick={handleAction}
              className="w-full py-3 rounded-lg font-medium text-black bg-gray-200 hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center"
            >
              <span>{copySuccess || (data.type === 'text' ? 'Copy Text' : 'Download File')}</span>
            </button>
          )}
        </div>
      </div>
      
      {data && data.viewData && (
        <div className="w-full max-w-2xl mt-6">
          <h2 className="text-lg font-medium text-gray-700 mb-3">File Preview</h2>
          <FileViewer fileData={data.viewData} seed={seed || ''} />
        </div>
      )}
    </div>
    </>
  );
} 