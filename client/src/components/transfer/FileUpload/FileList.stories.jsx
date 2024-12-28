import { FileList } from './FileList';
import { FileUpload } from './index';

export default {
  title: 'Transfer/FileList',
  component: FileList,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#1a1b1e'
        }
      ]
    }
  },
  decorators: [
    (Story) => (
      <div className="p-4 bg-backgroundPrimary">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onDeleteFile: { action: 'file deleted' },
    onFileUpload: { action: 'files uploaded' }
  }
};

// Mock files data
const mockFiles = [
  'document.pdf',
  'image.jpg',
  'archive.zip',
  'presentation.pptx',
  'spreadsheet.xlsx'
];

const mockUploadingFiles = new Set([
  'uploading1.mp4',
  'uploading2.docx'
]);

export const EmptyUploader = {
  render: () => (
    <FileUpload
      files={[]}
      uploadingFiles={new Set()}
      onFileUpload={(files) => console.log('Files uploaded:', files)}
      onDeleteFile={(filename) => console.log('Delete file:', filename)}
      disabled={false}
    />
  )
};

export const WithOneFile = {
  render: () => (
    <FileUpload
      files={['document.pdf']}
      uploadingFiles={new Set()}
      onFileUpload={(files) => console.log('Files uploaded:', files)}
      onDeleteFile={(filename) => console.log('Delete file:', filename)}
      disabled={false}
    />
  )
};

export const WithFiles = {
  render: () => (
    <FileUpload
      files={mockFiles}
      uploadingFiles={new Set()}
      onFileUpload={(files) => console.log('Files uploaded:', files)}
      onDeleteFile={(filename) => console.log('Delete file:', filename)}
      disabled={false}
    />
  )
};

export const WithUploading = {
  render: () => (
    <FileUpload
      files={mockFiles}
      uploadingFiles={mockUploadingFiles}
      onFileUpload={(files) => console.log('Files uploaded:', files)}
      onDeleteFile={(filename) => console.log('Delete file:', filename)}
      disabled={false}
    />
  )
};

export const Disabled = {
  render: () => (
    <FileUpload
      files={mockFiles}
      uploadingFiles={mockUploadingFiles}
      onFileUpload={(files) => console.log('Files uploaded:', files)}
      onDeleteFile={(filename) => console.log('Delete file:', filename)}
      disabled={true}
    />
  )
};

export const LongFileNames = {
  render: () => (
    <FileUpload
      files={[
        'very-long-file-name-that-might-overflow-the-container-2024-edition.pdf',
        'another-extremely-long-file-name-with-lots-of-characters-and-numbers-123456789.docx',
        'short.txt'
      ]}
      uploadingFiles={new Set([
        'currently-uploading-file-with-very-long-name-that-needs-to-be-displayed.mp4'
      ])}
      onFileUpload={(files) => console.log('Files uploaded:', files)}
      onDeleteFile={(filename) => console.log('Delete file:', filename)}
      disabled={false}
    />
  )
};

export const ManyFiles = {
  render: () => (
    <FileUpload
      files={[
        ...mockFiles,
        'extra1.pdf',
        'extra2.jpg',
        'extra3.png',
        'extra4.doc',
        'extra5.txt',
        'extra6.mp3',
        'extra7.mp4',
        'extra8.wav',
        'extra9.zip',
        'extra10.rar'
      ]}
      uploadingFiles={mockUploadingFiles}
      onFileUpload={(files) => console.log('Files uploaded:', files)}
      onDeleteFile={(filename) => console.log('Delete file:', filename)}
      disabled={false}
    />
  )
};

export const OnlyUploading = {
  render: () => (
    <FileUpload
      files={[]}
      uploadingFiles={new Set([
        'uploading1.mp4',
        'uploading2.docx',
        'uploading3.pdf',
        'uploading4.jpg'
      ])}
      onFileUpload={(files) => console.log('Files uploaded:', files)}
      onDeleteFile={(filename) => console.log('Delete file:', filename)}
      disabled={false}
    />
  )
};