'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

async function getData(seed: string) {
  console.log('fetching data for seed:', `http://localhost:5001/file-name/${seed}`);
  const response = await fetch(`http://localhost:5001/file-name/${seed}`);
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
}

export default function Home({ params }: { params: { seed: string } }) {
  const router = useRouter();
  const [data, setData] = React.useState<any>(null);
  const [seed, setSeed] = React.useState<string | null>(null);
  const [error, setError] = React.useState<any>(null);
  const [copySuccess, setCopySuccess] = React.useState('');

  React.useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setSeed(resolvedParams.seed);
    };

    resolveParams();
  }, [params]);

  React.useEffect(() => {
    if (seed) {
      const _getData = async () => {
        try {
          const data = await getData(seed);
          let data_type = data['file'] ? 'file' : 'text';
          let data_content = '';
          if (data_type === 'file') {
            data_content = data['file'];
            data_content = data_content.split('uploads/')[1];
          } else {
            data_content = data['text'];
          }

          setData({ type: data_type, content: data_content });
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
      .then(() => setCopySuccess('Copied !'))
      .catch(() => setCopySuccess('Failed to copy URL.'));
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-8 py-12 font-sans mt-7">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8 relative">
        <button
          onClick={() => router.push('/')}
          className="absolute top-4 left-4 text-gray-500 hover:text-gray-700"
          aria-label="Go Back"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Seed Data Viewer</h1>
        <div className="space-y-4">
          <p className="text-gray-700">Your Seed: <span className="font-medium text-black">{seed}</span></p>
          {data ? (
            <p className="text-gray-700">Data: <span className="font-medium text-black">{data.content}</span></p>
          ) : error ? (
            <p className="text-red-500">Error: {error}</p>
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}
          {data && data.type === 'file' && (
            <a
              href={`http://localhost:5001/download/${seed}`}
              className="text-gray-700 hover:underline"
            >
              Download File
            </a>
          )}
          <button
            onClick={copyToClipboard}
            className="w-full py-2 rounded-lg font-medium text-black bg-gray-300 hover:bg-gray-400 transition duration-200"
          >
            {copySuccess || 'Copy URL'}
          </button>
        </div>
      </div>
    </div>
  );
}
