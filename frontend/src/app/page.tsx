'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [activeTab, setActiveTab] = useState('upload');

  useEffect(() => {
    const storedValue = localStorage.getItem('active_tab');
    if (storedValue) {
      setActiveTab(storedValue);
    }
  }
  , []);

  const handleSetActiveTab = (value:string) => {
    setActiveTab(value);
    localStorage.setItem('active_tab', value);
  }



  return (
    <div className="flex flex-col items-center min-h-screen px-8 py-12 font-sans mt-7">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8">
        <div className="flex justify-around mb-6">
          <button
            className={`w-1/2 py-2 font-medium ${activeTab === 'upload' ? 'text-white bg-gray-500' : 'text-gray-500 bg-gray-200'} rounded-l-lg focus:outline-none`}
            onClick={() => handleSetActiveTab('upload')}
          >
            Upload
          </button>
          <button
            className={`w-1/2 py-2 font-medium ${activeTab === 'search' ? 'text-white bg-gray-500' : 'text-gray-500 bg-gray-200'} rounded-r-lg focus:outline-none`}
            onClick={() => handleSetActiveTab('search')}
          >
            Search
          </button>
        </div>

        {activeTab === 'upload' && <UploadTab />}
        {activeTab === 'search' && <SearchTab />}
      </div>
    </div>
  );
}

function SearchTab() {
  const [seedCode, setSeedCode] = useState('');
  const router = useRouter();

  const handleSearch = () => {
    if (seedCode.trim()) {
      router.push(`/${seedCode}`);
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-gray-700">Search</h2>
      <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-4">
        <input
          type="text"
          value={seedCode}
          onChange={(e) => setSeedCode(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter Seed Code"
        />
        <button
          type="submit"
          className="w-full py-2 rounded-lg font-medium text-white bg-gray-500 hover:bg-gray-600 transition duration-200"
        >
          Go to Seed Page
        </button>
      </form>
    </div>
  );
}


function UploadTab() {
  const router = useRouter();
  const [seedCode, setSeedCode] = useState('');
  const [metadata, setMetadata] = useState('');
  const [file, setFile] = useState(null);
  const [textMessage, setTextMessage] = useState('');
  const [uploadType, setUploadType] = useState('file');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedValue = localStorage.getItem('upload_type');
    if (storedValue) {
      setUploadType(storedValue);
    }
  }, []);

  const handleSetUploadType = (value:string) => {
    if (value !== 'file' && value !== 'text') {
      return;
    }
    setFile(null);
    setUploadType(value);
    localStorage.setItem('upload_type', value);
  };

  const handleFileChange = (e:any) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e:any) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData();
    formData.append('seed_code', seedCode);
    formData.append('metadata', metadata);
    formData.append('upload_type', uploadType);

    if (uploadType === 'file' && file) {
      formData.append('file', file);
    } else if (uploadType === 'text' && textMessage) {
      formData.append('text_message', textMessage);
    } else {
      setResult('Invalid input');
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.error) {
        setResult(`Error: ${result.error}`);
      } else {
        setResult('success');
        router.push(`/${seedCode}`);
      }
    } catch (error) {
      setResult('Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">Upload Type</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={uploadType}
          onChange={(e) => handleSetUploadType(e.target.value)}
        >
          <option value="file">File</option>
          <option value="text">Text</option>
        </select>
      </div>

      {uploadType === 'file' && (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">Choose a File</label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={uploadType === 'file'}
          />
        </div>
      )}

      {uploadType === 'text' && (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">Text Message</label>
          <textarea
            value={textMessage}
            onChange={(e) => setTextMessage(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            required={uploadType === 'text'}
          ></textarea>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">Seed Code</label>
        <input
          type="text"
          value={seedCode}
          onChange={(e) => setSeedCode(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <button
        type="submit"
        className={`w-full py-2 rounded-lg font-medium text-white ${isLoading ? 'bg-gray-300' : 'bg-gray-500 hover:bg-gray-600'} transition duration-200`}
        disabled={isLoading}
      >
        {isLoading ? 'Uploading...' : 'Upload'}
      </button>

      <div className="mt-6 text-center text-sm text-gray-600">
        {result === 'success' ? (
          <a
            href={`${window.location.href}/${seedCode}`}
            className="text-black hover:underline"
          >
            View your file
          </a>
        ) : (
          <span>{result}</span>
        )}
      </div>
    </form>
  );
}
