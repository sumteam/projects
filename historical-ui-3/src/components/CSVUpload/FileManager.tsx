import React, { useState, useEffect } from 'react';
import { X, Trash2, FileText } from 'lucide-react';
import { listCSVFiles, deleteCSVFile, CSVFileMetadata } from '../../services/csvService';

interface FileManagerProps {
  onSelectFile: (fileId: string) => void;
  selectedFileId?: string;
  onClose: () => void;
}

const FileManager: React.FC<FileManagerProps> = ({ onSelectFile, selectedFileId, onClose }) => {
  const [files, setFiles] = useState<CSVFileMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    const fileList = await listCSVFiles();
    setFiles(fileList);
    setLoading(false);
  };

  const handleDelete = async (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }

    const result = await deleteCSVFile(fileId);
    if (result.success) {
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } else {
      alert(result.error || 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDateRange = (start: Date, end: Date): string => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return `${formatDate(start)} to ${formatDate(end)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h2 className="text-white text-lg font-semibold">Manage CSV Files</h2>
          <button
            onClick={onClose}
            className="text-[#999] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto mb-4 text-[#666]" size={48} />
              <p className="text-[#999]">No CSV files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(file => (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file.id)}
                  className={`p-4 rounded border transition-colors cursor-pointer ${
                    selectedFileId === file.id
                      ? 'bg-blue-600 bg-opacity-20 border-blue-500'
                      : 'bg-[#2a2a2a] border-[#3a3a3a] hover:border-[#4a4a4a]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText size={16} className="text-[#999] flex-shrink-0" />
                        <span className="text-white font-medium truncate">{file.filename}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-[#999]">
                        <div>
                          <span className="text-[#666]">Rows:</span> {file.rowCount.toLocaleString()}
                        </div>
                        <div>
                          <span className="text-[#666]">Size:</span> {formatFileSize(file.fileSize)}
                        </div>
                        <div className="col-span-2">
                          <span className="text-[#666]">Date Range:</span> {formatDateRange(file.startDate, file.endDate)}
                        </div>
                        <div className="col-span-2">
                          <span className="text-[#666]">Timeframes:</span>{' '}
                          {file.availableTimeframes.length > 0
                            ? file.availableTimeframes.join(', ')
                            : 'None'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(file.id, e)}
                      className="ml-4 p-2 text-[#999] hover:text-red-500 transition-colors flex-shrink-0"
                      title="Delete file"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileManager;
