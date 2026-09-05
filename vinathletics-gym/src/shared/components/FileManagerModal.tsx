import { useState } from 'react';
import { Modal } from '../primitives/Modal.tsx';

export interface FileItem {
  name: string;
  size: string;
  url: string;
}

interface FileManagerModalProps {
  onClose: () => void;
  onSelect?: (file: FileItem) => void;
}

export function FileManagerModal({ onClose, onSelect }: FileManagerModalProps) {
  const [files] = useState<FileItem[]>([
    { name: 'Member_List_2026.pdf', size: '1.2 MB', url: '#' },
    { name: 'Financial_Report_Q3.xlsx', size: '450 KB', url: '#' },
    { name: 'Trainer_Schedules.docx', size: '80 KB', url: '#' },
    { name: 'Gym_Rules_Updated.pdf', size: '2.1 MB', url: '#' },
  ]);

  const handleUpload = () => {
    alert('Upload functionality would be implemented here');
  };

  return (
    <Modal title="File Manager" onClose={onClose} wide>
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 14, color: 'var(--steel)', margin: 0 }}>Manage and access your gym documents.</p>
          <button className="btn btn-signal btn-sm" onClick={handleUpload}>Upload File</button>
        </div>
        <div style={{ border: '1px solid var(--steel)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '10px 14px', background: 'var(--paper)', borderBottom: '1px solid var(--steel)', fontSize: 12, fontWeight: 'bold', color: 'var(--steel)', textTransform: 'uppercase' }}>
            <div style={{ flex: 2 }}>File Name</div>
            <div style={{ flex: 1 }}>Size</div>
            <div style={{ textAlign: 'right' }}>Action</div>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {files.map((file, i) => (
              <div key={i} style={{ display: 'flex', padding: '10px 14px', borderBottom: i === files.length - 1 ? 'none' : '1px solid var(--steel)', fontSize: 13, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ flex: 1, color: 'var(--steel)' }}>{file.size}</div>
                <div style={{ textAlign: 'right' }}>
                  <a href={file.url} className="btn btn-outline btn-sm" style={{ padding: '4px 8px', fontSize: 11 }}>Download</a>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-signal btn-sm" onClick={() => { alert('File selected'); onClose(); }}>Select</button>
        </div>
      </div>
    </Modal>
  );
}
