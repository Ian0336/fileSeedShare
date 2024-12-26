'use client';
import { randomBytes } from 'crypto';
import { useState } from 'react';

export default function Home() {
  const [seedCode, setSeedCode] = useState('');
  const [metadata, setMetadata] = useState('');
  const [file, setFile] = useState(null);
  const [textMessage, setTextMessage] = useState('');
  const [uploadType, setUploadType] = useState('file');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: any) => {
    setFile(e.target.files[0]);
  };
  const testFetch = async () => {
    // pretent to upload a file but actually just wait for 3 seconds and return a fake response in a promise way
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return {
      seed_code: 'fake_seed_code',
      download_link: randomBytes(16).toString('hex'),
      error: false,
    };
    

  }

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsLoading(prev => true);
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
    formData.forEach((value, key) => {
      console.log(`${key}: ${value}`);
    });
    try {
      const response = await fetch('http://localhost:5001/upload', {
        method: 'POST',
        body: formData,
      });
      // const result = await testFetch();

      const result = await response.json();

      if (result.error) {
        setResult(`Error: ${result.error}`);
      } else {
        setResult(
          `Seed code: ${result.seed_code}\nDownload link: ` +
            `<a href="${result.download_link}" target="_blank" rel="noopener noreferrer">${result.download_link}</a>`
        );
      }
    } catch (error) {
      setResult('Upload failed');
    } finally {
      setIsLoading(prev => false);
    }

  };
  return (
    <div className="items-center justify-items-center min-h-screen p-8 pb-20  sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div>
      <h1>File Upload</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Upload type:
          <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
            <option value="file">File</option>
            <option value="text">text</option>
          </select>
        </label>
        <br /><br />

        {uploadType === 'file' && (
          <label>
            Choose a file:
            <input type="file" onChange={handleFileChange} required={uploadType === 'file'} />
          </label>
        )}

        {uploadType === 'text' && (
          <label>
            Text message:
            <textarea
              value={textMessage}
              onChange={(e) => setTextMessage(e.target.value)}
              required={uploadType === 'text'}
            ></textarea>
          </label>
        )}
        <br /><br />

        <label>
          Seed code:
          <input
            type="text"
            value={seedCode}
            onChange={(e) => setSeedCode(e.target.value)}
            required
          />
        </label>
        {/* <br /><br />
        <label>
          Metadata:
          <input
            type="text"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
          />
        </label> */}
        <br /><br />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Uploading...' : 'Upload'}</button>
      </form>
      <div dangerouslySetInnerHTML={{ __html: result }} style={{ marginTop: '20px', whiteSpace: 'pre-line' }}></div>
    </div>
    </div>
  );
}
