import React, { useState, useRef } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadCSVFile } from '../../services/csvService';

interface CSVUploadProps {
  onUploadComplete: (fileId: string) => void;
  onClose?: () => void;
}

interface UploadStatus {
  filename: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  fileId?: string;
}

const CSVUpload: React.FC<CSVUploadProps> = ({ onUploadComplete, onClose }) => {
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const csvFiles = fileArray.filter(file =>
      file.name.endsWith('.csv') || file.type === 'text/csv'
    );

    if (csvFiles.length === 0) {
      alert('Please select CSV files only');
      return;
    }

    for (const file of csvFiles) {
      setUploadStatuses(prev => [...prev, {
        filename: file.name,
        status: 'uploading'
      }]);

      const result = await uploadCSVFile(file);

      setUploadStatuses(prev => prev.map(status =>
        status.filename === file.name
          ? {
              ...status,
              status: result.success ? 'success' : 'error',
              error: result.error,
              fileId: result.fileId
            }
          : status
      ));

      if (result.success && result.fileId) {
        onUploadComplete(result.fileId);
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const clearUploadStatuses = () => {
    setUploadStatuses([]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h2 className="text-white text-lg font-semibold">Upload CSV Files</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[#999] hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                : 'border-[#3a3a3a] hover:border-[#4a4a4a]'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto mb-4 text-[#999]" size={48} />
            <p className="text-white mb-2">Drag and drop CSV files here</p>
            <p className="text-[#999] text-sm mb-4">or</p>
            <button
              onClick={handleBrowseClick}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          <div className="bg-[#2a2a2a] rounded p-4">
            <h3 className="text-white font-medium mb-2">CSV Format Requirements</h3>
            <ul className="text-[#ccc] text-sm space-y-1 list-disc list-inside">
              <li>Required columns: datetime, open, high, low, close</li>
              <li>Datetime formats: YYYY-MM-DD HH:mm:ss, DD-MM-YYYY HH:mm:ss, MM-DD-YYYY HH:mm:ss, DD/MM/YYYY HH:mm:ss, or MM/DD/YYYY HH:mm:ss</li>
              <li>Optional: chain_detected_{'{'}number{'}{'}unit{'}'} columns (e.g., chain_detected_30s, chain_detected_1m, chain_detected_1h)</li>
              <li>Supported units: s (seconds), m (minutes), h (hours)</li>
              <li>Chain detection values should be -1, 0, or 1</li>
            </ul>
          </div>

          {uploadStatuses.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Upload Status</h3>
                <button
                  onClick={clearUploadStatuses}
                  className="text-[#999] hover:text-white text-sm"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {uploadStatuses.map((status, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-[#2a2a2a] p-3 rounded"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <File size={16} className="text-[#999] flex-shrink-0" />
                      <span className="text-white text-sm truncate">{status.filename}</span>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {status.status === 'uploading' && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      )}
                      {status.status === 'success' && (
                        <CheckCircle size={16} className="text-green-500" />
                      )}
                      {status.status === 'error' && (
                        <div className="flex items-center space-x-2">
                          <AlertCircle size={16} className="text-red-500" />
                          {status.error && (
                            <span className="text-red-400 text-xs">{status.error}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVUpload;
