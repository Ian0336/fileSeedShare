'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

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

  return (
    <div className="flex flex-col items-center min-h-screen px-8 py-12 font-sans mt-7">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8 relative">
        <button
          onClick={() => router.push('/')}
          className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 cursor-pointer focus:outline-none"
          aria-label="Go Back"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Seed Data Viewer</h1>
        <div className="space-y-4">
          <p className="text-gray-700">
            Your Seed: <span className="font-medium text-black">{seed}</span>
          </p>
          {data ? (
            <p className="text-gray-700">
              Data: <span className="break-all">{data.content}</span>
            </p>
          ) : error ? (
            <p className="text-red-500">Error: {error}</p>
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}
          {data && (
            <button
              onClick={handleAction}
              className="w-full py-2 rounded-lg font-medium text-black bg-gray-300 hover:bg-gray-400 transition duration-200"
            >
              {copySuccess || (data.type === 'text' ? 'Copy Text' : 'Download File')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 