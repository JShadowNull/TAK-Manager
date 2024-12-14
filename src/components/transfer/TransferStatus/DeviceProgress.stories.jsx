import { DeviceProgress } from './DeviceProgress.jsx';
import { TransferStatus } from './index.jsx';
import { CloseIcon } from '../../shared/icons/CloseIcon.jsx';

export default {
  title: 'Transfer/DeviceProgress',
  component: DeviceProgress,
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
};

// Mock progress data for different states
const mockProgress = {
  preparing: {
    status: 'preparing',
    progress: 0,
    currentFile: 'Preparing transfer...',
    fileProgress: 0,
    fileNumber: 0,
    totalFiles: 5
  },
  transferring: {
    status: 'transferring',
    progress: 45,
    currentFile: 'transferring file_example.zip',
    fileProgress: 75,
    fileNumber: 2,
    totalFiles: 5
  },
  completed: {
    status: 'completed',
    progress: 100,
    currentFile: '',
    fileProgress: 100,
    fileNumber: 5,
    totalFiles: 5
  },
  failed: {
    status: 'failed',
    progress: 60,
    currentFile: 'Failed at: file_example.zip',
    fileProgress: 30,
    fileNumber: 3,
    totalFiles: 5
  }
};

const mockDeviceStatus = {
  text: 'Connected devices: Galaxy S21 (R5CT90XBKDP)',
  isConnected: true,
  devices: {
    'Galaxy S21 (R5CT90XBKDP)': { id: 'Galaxy S21 (R5CT90XBKDP)' }
  }
};

export const Preparing = {
  render: () => (
    <TransferStatus
      deviceStatus={mockDeviceStatus}
      deviceProgress={{
        'Galaxy S21 (R5CT90XBKDP)': mockProgress.preparing
      }}
      isTransferRunning={true}
      filesExist={true}
      onRemoveFailed={() => console.log('Remove failed clicked')}
      onStartTransfer={() => console.log('Start transfer clicked')}
      onStopTransfer={() => console.log('Stop transfer clicked')}
    />
  )
};

export const Transferring = {
  render: () => (
    <TransferStatus
      deviceStatus={mockDeviceStatus}
      deviceProgress={{
        'Galaxy S21 (R5CT90XBKDP)': mockProgress.transferring
      }}
      isTransferRunning={true}
      filesExist={true}
      onRemoveFailed={() => console.log('Remove failed clicked')}
      onStartTransfer={() => console.log('Start transfer clicked')}
      onStopTransfer={() => console.log('Stop transfer clicked')}
    />
  )
};

export const Completed = {
  render: () => (
    <TransferStatus
      deviceStatus={mockDeviceStatus}
      deviceProgress={{
        'Galaxy S21 (R5CT90XBKDP)': mockProgress.completed
      }}
      isTransferRunning={false}
      filesExist={true}
      onRemoveFailed={() => console.log('Remove failed clicked')}
      onStartTransfer={() => console.log('Start transfer clicked')}
      onStopTransfer={() => console.log('Stop transfer clicked')}
    />
  )
};

export const Failed = {
  render: () => (
    <TransferStatus
      deviceStatus={{
        ...mockDeviceStatus,
        isConnected: false,
        text: 'Waiting for device...'
      }}
      deviceProgress={{
        'Galaxy S21 (R5CT90XBKDP)': mockProgress.failed
      }}
      isTransferRunning={false}
      filesExist={true}
      onRemoveFailed={() => console.log('Remove failed clicked')}
      onStartTransfer={() => console.log('Start transfer clicked')}
      onStopTransfer={() => console.log('Stop transfer clicked')}
    />
  )
};

export const MultipleDevices = {
  render: () => (
    <TransferStatus
      deviceStatus={{
        text: 'Connected devices: Galaxy S21, Pixel 6, OnePlus 9',
        isConnected: true,
        devices: {
          'Galaxy S21 (R5CT90XBKDP)': { id: 'Galaxy S21 (R5CT90XBKDP)' },
          'Pixel 6 (18KAY1HDJK)': { id: 'Pixel 6 (18KAY1HDJK)' },
          'OnePlus 9 (OP9BDJK78)': { id: 'OnePlus 9 (OP9BDJK78)' }
        }
      }}
      deviceProgress={{
        'Galaxy S21 (R5CT90XBKDP)': mockProgress.transferring,
        'Pixel 6 (18KAY1HDJK)': mockProgress.preparing,
        'OnePlus 9 (OP9BDJK78)': mockProgress.failed
      }}
      isTransferRunning={true}
      filesExist={true}
      onRemoveFailed={() => console.log('Remove failed clicked')}
      onStartTransfer={() => console.log('Start transfer clicked')}
      onStopTransfer={() => console.log('Stop transfer clicked')}
    />
  )
}; 