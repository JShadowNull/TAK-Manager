import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/shadcn/tabs";
import CreateCertificates from '../components/certmanager/CreateCertificates';
import ExistingCertificates from '../components/certmanager/ExistingCertificates';

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

  const certData = { certificates: [] }; // Default or mock data
  const isLoading = false; // Default loading status

  // Effect to store current tab in sessionStorage
  useEffect(() => {
    sessionStorage.setItem('certManagerTab', currentTab);
  }, [currentTab]);

  const handleBatchDataPackage = () => {
    navigate('/data-package');
  };

  const handleOperationProgress = () => {
    return operationStatus;
  };

  return (
    <div className="bg-background text-foreground pt-4">
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
};

export default CertManager; 