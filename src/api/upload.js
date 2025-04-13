import API from './auth'; // reuses the same API setup

export const uploadFile = (formData) => API.post('/upload', formData);
import React, { useState } from 'react';
import { uploadFile } from './api/upload';

export default function UploadModal() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('file', file);
    data.append('title', title);

    const res = await uploadFile(data);
    alert('Uploaded to: ' + res.data.filePath);
  };

  return (
    <form onSubmit={handleUpload}>
      <input type="text" placeholder="Title" onChange={e => setTitle(e.target.value)} />
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <button type="submit">Upload</button>
    </form>
  );
}
