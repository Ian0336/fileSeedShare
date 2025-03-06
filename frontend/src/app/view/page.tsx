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
    // Include all directly viewable file types including videos
    const isDirectViewable = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'pdf', 'mp4', 'webm', 'mov'].includes(extension);
    
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
      try {
        const viewResponse = await fetch(`/api/view-file/${seed}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (viewResponse.ok) {
          // Check if the response is JSON
          const contentType = viewResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const viewData = await viewResponse.json();
            return { ...data, viewData };
          } else {
            // Not JSON data, just provide file metadata
            return {
              ...data,
              viewData: {
                fileType: extension,
                fileName: filePath.split('uploads/')[1].split('-').slice(1).join('-')
              }
            };
          }
        }
      } catch (error) {
        console.error("Error fetching file metadata:", error);
        // Return basic file info if JSON parsing fails
        return {
          ...data,
          viewData: {
            fileType: extension,
            fileName: filePath.split('uploads/')[1].split('-').slice(1).join('-')
          }
        };
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
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Get seed from localStorage
    const storedSeed = localStorage.getItem('current_seed');
    if (!storedSeed) {
      router.push('/'); // Return to homepage if no seed
      return;
    }
    setSeed(storedSeed);
  }, [router]);

  React.useEffect(() => {
    if (seed) {
      const _getData = async () => {
        
        setIsLoading(true);
        try {
          const data = await getData(seed);
          const dataType = data['file'] ? 'file' : 'text';
          
          setData({ type: dataType, rawData: data, viewData: data.viewData });
        } catch (error) {
          console.error(error);
          if (error instanceof Error) {
            setError(error.message);
          } else {
            setError(String(error));
          }
        }finally {
          setIsLoading(false);
        }
      };
      _getData();
    }
  }, [seed]);

  const handleAction = () => {
    if (!data) return;
    
    if (data.type === 'text') {
      navigator.clipboard.writeText(data.rawData.text)
        .then(() => setCopySuccess('Text copied!'))
        .catch(() => setCopySuccess('Failed to copy text.'));
    } else if (data.type === 'file') {
      // Trigger file download
      window.location.href = `/api/download/${seed}`;
      setCopySuccess('Downloaded!');
    }
  };
  return (
    <div className="flex flex-col items-center min-h-screen bg-white px-4 py-12 font-sans">
      <div className="w-full max-w-2xl">
        <div className="mb-6 bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="flex items-center justify-center relative py-6 border-b border-gray-200">
            <button
              onClick={() => router.push('/')}
              className="absolute left-4 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Go Back"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold text-gray-800">Seed Data Viewer</h1>
          </div>
          <div className="p-6">
            <div className="flex items-center bg-gray-100 p-3 rounded-lg border border-gray-200 mb-5">
              <p className="text-gray-700 mr-2">Seed:</p>
              <span className="font-mono bg-white px-3 py-1 rounded border border-gray-200 text-gray-800">{seed}</span>
            </div>
            
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-2/3"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-red-500">Error: {error}</p>
              </div>
            ) :   <></>
            }
          </div>
          </div>
      
      
    </div>
    {!isLoading && data && data.viewData && (
        <div className="w-full max-w-[1000px] mt-6">
          <h2 className="text-lg font-medium text-gray-700 mb-3">File Preview</h2>
          <FileViewer fileData={data.viewData} seed={seed || ''} />
        </div>
      )}
    </div>
  );
} 