import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/shadcn/tabs";
import CreateCertificates from '../components/certmanager/CreateCertificates';
import ExistingCertificates from '../components/certmanager/ExistingCertificates';
import { useTakServerRequired } from '../components/shared/hooks/useTakServerRequired';
import TakServerRequiredDialog from '../components/shared/TakServerRequiredDialog';

interface OperationStatus {
  status: string;
  message: string;
}

const CertManager: React.FC = () => {
  const navigate = useNavigate();
  const [operationStatus] = useState<OperationStatus | null>(null);
  const [currentTab, setCurrentTab] = useState(() => {
    return sessionStorage.getItem('certManagerTab') || 'create-certs';
  });

  // TAK Server check
  const { showDialog, dialogProps, isServerRunning } = useTakServerRequired({
    title: "TAK Server Required for Certificate Management",
    description: "Certificate operations require TAK Server to be running. Would you like to start it now?",
  });

  // Show dialog immediately if server is not running
  useEffect(() => {
    if (!isServerRunning) {
      showDialog(true);
    }
  }, [isServerRunning, showDialog]);

  // Effect to store current tab in sessionStorage
  useEffect(() => {
    sessionStorage.setItem('certManagerTab', currentTab);
  }, [currentTab]);

  const certData = { certificates: [] }; // Default or mock data
  const isLoading = false; // Default loading status

  const handleBatchDataPackage = () => {
    navigate('/data-package');
  };

  const handleOperationProgress = () => {
    return operationStatus;
  };

  const renderContent = () => (
    <div className={`bg-background text-foreground pt-4 ${!isServerRunning ? 'pointer-events-none opacity-50' : ''}`}>
      <div className="mx-auto space-y-8">
        <Tabs defaultValue={currentTab} onValueChange={setCurrentTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-muted">
              <TabsTrigger 
                value="create-certs" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Create Certificates
              </TabsTrigger>
              <TabsTrigger 
                value="existing-certs" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Existing Certificates
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="w-full">
            <TabsContent value="create-certs" className="w-full">
              <CreateCertificates 
                onOperationProgress={handleOperationProgress}
              />
            </TabsContent>
            <TabsContent value="existing-certs" className="w-full">
              <ExistingCertificates
                certificates={certData.certificates}
                onCreateDataPackage={handleBatchDataPackage}
                onOperationProgress={handleOperationProgress}
                isLoading={isLoading}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );

  return (
    <>
      {renderContent()}
      <TakServerRequiredDialog {...dialogProps} />
    </>
  );
};

export default CertManager; 